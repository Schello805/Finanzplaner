import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { checkPwnedPassword, hashPassword, validatePassword, verifyPassword } from "@/lib/security";
import { createSessionToken, readSessionToken, SESSION_COOKIE } from "@/lib/session";

const schema=z.object({currentPassword:z.string(),newPassword:z.string()});
export async function POST(request:NextRequest){const token=request.cookies.get(SESSION_COOKIE)?.value;if(!token)return NextResponse.json({error:"Nicht angemeldet."},{status:401});
  const session=await readSessionToken(token).catch(()=>null);if(!session)return NextResponse.json({error:"Sitzung ungültig."},{status:401});
  const data=schema.safeParse(await request.json().catch(()=>null));if(!data.success)return NextResponse.json({error:"Eingaben unvollständig."},{status:400});
  const issues=validatePassword(data.data.newPassword);if(issues.length)return NextResponse.json({error:issues[0]},{status:400});
  const [user]=await db.select().from(users).where(eq(users.id,session.userId)).limit(1);if(!user?.passwordHash||!await verifyPassword(user.passwordHash,data.data.currentPassword))return NextResponse.json({error:"Das bisherige Passwort ist falsch."},{status:400});
  const pwned=await checkPwnedPassword(data.data.newPassword);if(pwned.status==="pwned")return NextResponse.json({error:"Dieses Passwort ist aus einem bekannten Datenleck bekannt. Bitte wähle ein anderes."},{status:400});
  await db.update(users).set({passwordHash:await hashPassword(data.data.newPassword),mustChangePassword:false,updatedAt:new Date()}).where(eq(users.id,user.id));
  const newToken=await createSessionToken({...session,mustChangePassword:false});const response=NextResponse.json({ok:true,pwnedCheck:pwned.status});response.cookies.set(SESSION_COOKIE,newToken,{httpOnly:true,sameSite:"strict",secure:false,path:"/",maxAge:60*60*12});return response;}
