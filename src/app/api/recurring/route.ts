import { NextResponse } from "next/server";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, categories, recurringTransactions, transactions } from "@/db/schema";
import { detectRecurring, normalizeRecurringMerchant } from "@/features/analytics/recurring";
import { requireUser } from "@/lib/current-user";
import { memberAndVisibleAccountIds } from "@/lib/visible-accounts";
import { writeAudit } from "@/lib/audit";

export async function GET() {
  try {
    const user = await requireUser(); const { accountIds } = await memberAndVisibleAccountIds(user.userId);
    if(!accountIds.length)return NextResponse.json([]);
    const from=new Date();from.setUTCMonth(from.getUTCMonth()-14);
    const [rows,dismissed]=await Promise.all([db.select({id:transactions.id,accountId:transactions.accountId,bookedOn:transactions.bookedOn,amount:transactions.amount,merchant:transactions.counterparty,categoryName:categories.name,accountName:accounts.name})
      .from(transactions).innerJoin(accounts,eq(transactions.accountId,accounts.id)).leftJoin(categories,eq(transactions.categoryId,categories.id))
      .where(and(inArray(transactions.accountId,accountIds),eq(transactions.direction,"expense"),eq(transactions.excludedFromAnalysis,false),gte(transactions.bookedOn,from.toISOString().slice(0,10)),sql`${transactions.amount} <> 0`)).orderBy(desc(transactions.bookedOn)),db.select({accountId:recurringTransactions.accountId,merchantPattern:recurringTransactions.merchantPattern}).from(recurringTransactions).where(and(inArray(recurringTransactions.accountId,accountIds),eq(recurringTransactions.status,"dismissed")))]);
    const ignored=new Set(dismissed.map(item=>`${item.accountId}|${item.merchantPattern}`));
    const candidates=accountIds.flatMap(accountId=>detectRecurring(rows.filter(row=>row.accountId===accountId).map(row=>({id:row.id,bookedOn:row.bookedOn,amount:Number(row.amount),merchant:row.merchant??""}))).map(candidate=>({...candidate,accountId}))).filter(candidate=>!ignored.has(`${candidate.accountId}|${normalizeRecurringMerchant(candidate.merchant)}`));
    const byId=new Map(rows.map(row=>[row.id,row]));
    return NextResponse.json(candidates.map(candidate=>{const latest=byId.get(candidate.transactionIds.at(-1)!);return{...candidate,lastSeenOn:latest?.bookedOn,categoryName:latest?.categoryName??"Nicht zugeordnet",accountName:latest?.accountName??"",cadence:candidate.cadenceDays<10?"Wöchentlich":candidate.cadenceDays>300?"Jährlich":"Monatlich"}}));
  } catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Wiederkehrende Zahlungen konnten nicht ermittelt werden."},{status:400})}
}

export async function DELETE(request:Request){try{const user=await requireUser();const{accountIds}=await memberAndVisibleAccountIds(user.userId);const body=await request.json() as {accountId?:string;merchant?:string;cadenceDays?:number;averageAmount?:number;lastSeenOn?:string};if(!body.accountId||!accountIds.includes(body.accountId)||!body.merchant?.trim())throw new Error("Wiederkehrende Zahlung ist nicht sichtbar.");const merchantPattern=normalizeRecurringMerchant(body.merchant);await db.delete(recurringTransactions).where(and(eq(recurringTransactions.accountId,body.accountId),eq(recurringTransactions.merchantPattern,merchantPattern),eq(recurringTransactions.status,"dismissed")));await db.insert(recurringTransactions).values({accountId:body.accountId,merchantPattern,cadenceDays:Math.max(1,Math.round(body.cadenceDays??30)),expectedAmount:Number(body.averageAmount??0).toFixed(2),status:"dismissed",lastSeenOn:body.lastSeenOn??new Date().toISOString().slice(0,10)});await writeAudit("recurring-dismissed",`Wiederkehrende Erkennung „${body.merchant}“ wurde ausgeblendet.`,{userId:user.userId,metadata:{accountId:body.accountId,merchantPattern}});return NextResponse.json({ok:true})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Wiederkehrende Zahlung konnte nicht gelöscht werden."},{status:400})}}
