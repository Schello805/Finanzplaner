import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, accountShares, guardians, householdMembers } from "@/db/schema";
import { accountIsVisible } from "@/lib/account-access-policy";

export async function memberAndVisibleAccountIds(userId:string){
  const[member]=await db.select().from(householdMembers).where(eq(householdMembers.userId,userId)).limit(1);
  if(!member)throw new Error("Kein Haushalt eingerichtet.");
  const[children,shares,householdAccounts]=await Promise.all([
    db.select({id:guardians.childMemberId}).from(guardians).where(eq(guardians.guardianMemberId,member.id)),
    db.select({id:accountShares.accountId}).from(accountShares).where(eq(accountShares.memberId,member.id)),
    db.select({id:accounts.id,kind:accounts.kind,ownerMemberId:accounts.ownerMemberId}).from(accounts).where(eq(accounts.householdId,member.householdId)),
  ]);
  const childIds=new Set(children.map(item=>item.id));const sharedIds=new Set(shares.map(item=>item.id));
  return{member,accountIds:householdAccounts.filter(account=>accountIsVisible(account,{id:member.id,kind:member.kind},childIds,sharedIds)).map(account=>account.id)};
}
