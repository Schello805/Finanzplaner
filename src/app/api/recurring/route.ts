import { NextResponse } from "next/server";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, categories, transactions } from "@/db/schema";
import { detectRecurring } from "@/features/analytics/recurring";
import { requireUser } from "@/lib/current-user";
import { memberAndVisibleAccountIds } from "@/lib/visible-accounts";

export async function GET() {
  try {
    const user = await requireUser(); const { accountIds } = await memberAndVisibleAccountIds(user.userId);
    if(!accountIds.length)return NextResponse.json([]);
    const from=new Date();from.setUTCMonth(from.getUTCMonth()-14);
    const rows=await db.select({id:transactions.id,bookedOn:transactions.bookedOn,amount:transactions.amount,merchant:transactions.counterparty,categoryName:categories.name,accountName:accounts.name})
      .from(transactions).innerJoin(accounts,eq(transactions.accountId,accounts.id)).leftJoin(categories,eq(transactions.categoryId,categories.id))
      .where(and(inArray(transactions.accountId,accountIds),eq(transactions.direction,"expense"),eq(transactions.excludedFromAnalysis,false),gte(transactions.bookedOn,from.toISOString().slice(0,10)),sql`${transactions.amount} <> 0`)).orderBy(desc(transactions.bookedOn));
    const candidates=detectRecurring(rows.map(row=>({id:row.id,bookedOn:row.bookedOn,amount:Number(row.amount),merchant:row.merchant??""})));
    const byId=new Map(rows.map(row=>[row.id,row]));
    return NextResponse.json(candidates.map(candidate=>{const latest=byId.get(candidate.transactionIds.at(-1)!);return{...candidate,lastSeenOn:latest?.bookedOn,categoryName:latest?.categoryName??"Nicht zugeordnet",accountName:latest?.accountName??"",cadence:candidate.cadenceDays<10?"Wöchentlich":candidate.cadenceDays>300?"Jährlich":"Monatlich"}}));
  } catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Wiederkehrende Zahlungen konnten nicht ermittelt werden."},{status:400})}
}
