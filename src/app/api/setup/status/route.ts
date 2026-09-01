import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { householdMembers } from "@/db/schema";
import { requireUser } from "@/lib/current-user";
export async function GET(){try{const user=await requireUser();const member=await db.select({id:householdMembers.id}).from(householdMembers).where(eq(householdMembers.userId,user.userId)).limit(1);return NextResponse.json({configured:Boolean(member.length)});}catch{return NextResponse.json({error:"Nicht angemeldet."},{status:401})}}
