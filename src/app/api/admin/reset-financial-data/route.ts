import {NextResponse} from "next/server";
import {eq,inArray} from "drizzle-orm";
import {z} from "zod";
import {db} from "@/db";
import {accounts,aiUsage,amazonOrderImports,categories,categorizationRules,householdMembers,imports,recurringTransactions,transactions} from "@/db/schema";
import {defaultCategories} from "@/features/categories/defaults";
import {requireAdmin} from "@/lib/current-user";
import {writeAudit} from "@/lib/audit";

const schema=z.object({confirmation:z.literal("ALLES LÖSCHEN")});

export async function POST(request:Request){
 try{
  const admin=await requireAdmin();
  schema.parse(await request.json());
  const[member]=await db.select({householdId:householdMembers.householdId}).from(householdMembers).where(eq(householdMembers.userId,admin.userId)).limit(1);
  if(!member)throw new Error("Kein Haushalt eingerichtet.");
  const accountRows=await db.select({id:accounts.id}).from(accounts).where(eq(accounts.householdId,member.householdId));
  const accountIds=accountRows.map(row=>row.id);
  await db.transaction(async tx=>{
   await tx.delete(amazonOrderImports).where(eq(amazonOrderImports.householdId,member.householdId));
   if(accountIds.length){
    await tx.delete(recurringTransactions).where(inArray(recurringTransactions.accountId,accountIds));
    await tx.delete(transactions).where(inArray(transactions.accountId,accountIds));
    await tx.delete(imports).where(inArray(imports.accountId,accountIds));
   }
   await tx.delete(categorizationRules).where(eq(categorizationRules.householdId,member.householdId));
   await tx.delete(aiUsage).where(eq(aiUsage.householdId,member.householdId));
   await tx.delete(categories).where(eq(categories.householdId,member.householdId));
   const parents=new Map<string,string>();
   for(const[sortOrder,[name,slug,color,icon,parentSlug,isIncome]]of defaultCategories.entries()){
    const[row]=await tx.insert(categories).values({householdId:member.householdId,name,slug,color,icon,parentId:parentSlug?parents.get(parentSlug)??null:null,isIncome:Boolean(isIncome),sortOrder}).returning({id:categories.id});
    parents.set(slug,row.id);
   }
  });
  await writeAudit("data-reset","Alle Finanz- und Importdaten des Haushalts wurden zurückgesetzt.",{userId:admin.userId,metadata:{householdId:member.householdId,accountsPreserved:accountIds.length,categoriesCreated:defaultCategories.length}});
  return NextResponse.json({ok:true,categoriesCreated:defaultCategories.length,accountsPreserved:accountIds.length});
 }catch(error){
  return NextResponse.json({error:error instanceof Error?error.message:"Finanzdaten konnten nicht zurückgesetzt werden."},{status:400});
 }
}
