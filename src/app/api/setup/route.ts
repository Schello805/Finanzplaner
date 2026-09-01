import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { categories, householdMembers, households, importTemplates } from "@/db/schema";
import { defaultCategories } from "@/features/categories/defaults";
import { sparkasseCamtV8 } from "@/features/import/sparkasse-camt-v8";
import { requireUser } from "@/lib/current-user";
const input=z.object({householdName:z.string().trim().min(2).max(80),displayName:z.string().trim().min(2).max(80)});
export async function POST(request:Request){try{const user=await requireUser();const body=input.parse(await request.json());const existing=await db.select().from(householdMembers).where(eq(householdMembers.userId,user.userId)).limit(1);if(existing.length)return NextResponse.json({error:"Die Ersteinrichtung wurde bereits abgeschlossen."},{status:409});
  const result=await db.transaction(async tx=>{const[household]=await tx.insert(households).values({name:body.householdName}).returning();const[member]=await tx.insert(householdMembers).values({householdId:household.id,userId:user.userId,displayName:body.displayName,kind:"adult"}).returning();const parents=new Map<string,string>();for(const [name,slug,color,icon,parentSlug,isIncome] of defaultCategories){const[parentId]=parentSlug?[parents.get(parentSlug)]:[undefined];const[row]=await tx.insert(categories).values({householdId:household.id,name,slug,color,icon,parentId,isIncome:Boolean(isIncome)}).returning();parents.set(slug,row.id)}await tx.insert(importTemplates).values({householdId:household.id,name:sparkasseCamtV8.name,bankName:sparkasseCamtV8.bankName,enabled:true,builtin:true,testedAt:new Date(),createdBy:user.userId,config:{delimiter:sparkasseCamtV8.delimiter,encoding:sparkasseCamtV8.encoding,headerRow:1,skipEmptyLines:true,dateFormat:sparkasseCamtV8.dateFormat,decimalSeparator:sparkasseCamtV8.decimalSeparator,columns:sparkasseCamtV8.columns as Record<string,string>,requiredFields:sparkasseCamtV8.requiredFields}});return {householdId:household.id,memberId:member.id}});return NextResponse.json(result,{status:201});
}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Einrichtung fehlgeschlagen."},{status:400})}}
