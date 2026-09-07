import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, amazonOrderItems, imports, transactions, transactionSplits } from "@/db/schema";
import { requireUser } from "@/lib/current-user";
import { memberAndVisibleAccountIds } from "@/lib/visible-accounts";
import { findTransferCandidates } from "@/features/analytics/transfers";
import { findStoredReferenceDuplicates } from "@/features/import/reconciliation";
import { VERY_SAFE_CONFIDENCE } from "@/features/categorization/confidence";

function missingMonths(from:string|null,to:string|null,available:string[]){
  if(!from||!to)return[];
  const found=new Set(available),result:string[]=[];
  let date=new Date(`${from.slice(0,7)}-01T12:00:00Z`);
  const end=new Date(`${to.slice(0,7)}-01T12:00:00Z`);
  while(date<=end){const key=date.toISOString().slice(0,7);if(!found.has(key))result.push(key);date=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,1,12));}
  return result;
}

export async function GET(request:NextRequest){
  try{
    const user=await requireUser();
    const{member,accountIds:visibleAccountIds}=await memberAndVisibleAccountIds(user.userId);
    const requested=request.nextUrl.searchParams.get("accountId");
    if(requested&&!visibleAccountIds.includes(requested))throw new Error("Konto nicht sichtbar.");
    const accountIds=requested?[requested]:visibleAccountIds;
    if(!accountIds.length)return NextResponse.json({accounts:[],totals:{uncategorized:0,lowConfidence:0,amazonOpen:0,qualityPercent:0,total:0,confirmed:0,automaticSafe:0,needsReview:0}});
    const[accountRows,txRows,splitRows,importRows,amazonRows]=await Promise.all([
      db.select({id:accounts.id,name:accounts.name}).from(accounts).where(inArray(accounts.id,accountIds)),
      db.select({id:transactions.id,accountId:transactions.accountId,bookedOn:transactions.bookedOn,amount:transactions.amount,currency:transactions.currency,counterparty:transactions.counterparty,purpose:transactions.purpose,bankReference:transactions.bankReference,specialType:transactions.specialType,linkedTransactionId:transactions.linkedTransactionId,excludedFromAnalysis:transactions.excludedFromAnalysis,categoryId:transactions.categoryId,confidence:transactions.categorizationConfidence,categorizedBy:transactions.categorizedBy}).from(transactions).where(and(inArray(transactions.accountId,accountIds),sql`${transactions.amount} <> 0`)),
      db.select({transactionId:transactionSplits.transactionId}).from(transactionSplits).innerJoin(transactions,eq(transactionSplits.transactionId,transactions.id)).where(inArray(transactions.accountId,accountIds)),
      db.select({accountId:imports.accountId,completedAt:imports.completedAt,filename:imports.originalFilename}).from(imports).where(and(inArray(imports.accountId,accountIds),eq(imports.status,"completed"))).orderBy(desc(imports.completedAt)),
      db.select({id:amazonOrderItems.id}).from(amazonOrderItems).where(and(eq(amazonOrderItems.ownerMemberId,member.id),sql`${amazonOrderItems.matchedTransactionId} is null`)),
    ]);
    const splitIds=new Set(splitRows.map(row=>row.transactionId));
    let uncategorized=0,needsReview=0,confirmed=0,automaticSafe=0;
    const result=accountRows.map(account=>{
      const rows=txRows.filter(row=>row.accountId===account.id&&!row.excludedFromAnalysis&&row.specialType!=="transfer");
      const dates=rows.map(row=>row.bookedOn).sort();
      const months=[...new Set(dates.map(value=>value.slice(0,7)))];
      let accountOpen=0,accountReview=0;
      for(const row of rows){
        const assigned=Boolean(row.categoryId||splitIds.has(row.id));
        if(!assigned){accountOpen++;uncategorized++;continue;}
        const automatic=row.categorizedBy?.startsWith("ai:")||row.categorizedBy==="local-keyword";
        if(automatic&&Number(row.confidence??0)<VERY_SAFE_CONFIDENCE){accountReview++;needsReview++;}
        else if(automatic){automaticSafe++;}
        else confirmed++;
      }
      const qualityPercent=rows.length?Math.round((rows.length-accountOpen-accountReview)/rows.length*100):0;
      const lastImport=importRows.find(item=>item.accountId===account.id);
      return{id:account.id,name:account.name,transactionCount:rows.length,from:dates[0]??null,to:dates.at(-1)??null,lastImportAt:lastImport?.completedAt??null,lastFilename:lastImport?.filename??null,uncategorized:accountOpen,lowConfidence:accountReview,qualityPercent,missingMonths:missingMonths(dates[0]??null,dates.at(-1)??null,months)};
    });
    const withAccountName=(row:typeof txRows[number])=>({...row,accountName:accountRows.find(account=>account.id===row.accountId)?.name??"Konto"});
    const transferCandidates=findTransferCandidates(txRows.map(withAccountName));
    const duplicateCandidates=findStoredReferenceDuplicates(txRows.filter(row=>!row.excludedFromAnalysis)).map(pair=>({original:withAccountName(pair.original),duplicate:withAccountName(pair.duplicate)}));
    const total=result.reduce((sum,account)=>sum+account.transactionCount,0);
    const qualityPercent=total?Math.round((confirmed+automaticSafe)/total*100):0;
    return NextResponse.json({accounts:result,transferCandidates,duplicateCandidates,totals:{uncategorized,lowConfidence:needsReview,amazonOpen:amazonRows.length,qualityPercent,total,confirmed,automaticSafe,needsReview}});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Datenqualität konnte nicht geprüft werden."},{status:400});
  }
}
