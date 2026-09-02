import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/security";
import { decryptSecret } from "@/lib/security";
import { verifyTotp } from "@/lib/totp";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";

const schema=z.object({username:z.string().min(1).max(80),password:z.string().min(1).max(128),code:z.string().regex(/^\d{6}$/).optional()});
export async function POST(request:Request){
  const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"Benutzername und Passwort sind erforderlich."},{status:400});
  const [user]=await db.select().from(users).where(sql`lower(${users.username})=lower(${parsed.data.username})`).limit(1);
  if(!user?.passwordHash||user.disabledAt||!await verifyPassword(user.passwordHash,parsed.data.password))return NextResponse.json({error:"Benutzername oder Passwort ist falsch."},{status:401});
  if(user.totpSecretEncrypted&&!parsed.data.code)return NextResponse.json({requiresTwoFactor:true},{status:202});
  if(user.totpSecretEncrypted&&!verifyTotp(decryptSecret(user.totpSecretEncrypted),parsed.data.code??""))return NextResponse.json({error:"Der Bestätigungscode ist falsch oder abgelaufen."},{status:401});
  await db.update(users).set({lastLoginAt:new Date()}).where(eq(users.id,user.id));
  const token=await createSessionToken({userId:user.id,username:user.username,isAdmin:user.isAdmin,mustChangePassword:user.mustChangePassword});
  const response=NextResponse.json({ok:true,mustChangePassword:user.mustChangePassword});response.cookies.set(SESSION_COOKIE,token,{httpOnly:true,sameSite:"strict",secure:false,path:"/",maxAge:60*60*12});return response;
}
