import { NextRequest, NextResponse } from "next/server";
import { readSessionToken, SESSION_COOKIE } from "@/lib/session";

export async function proxy(request:NextRequest){
  const path=request.nextUrl.pathname;
  if(path.startsWith("/anmelden")||path.startsWith("/einladung")||path.startsWith("/passwort-vergessen")||path.startsWith("/passwort-zuruecksetzen")||path.startsWith("/api/auth")||path.startsWith("/api/invitations/accept")||path.startsWith("/_next")||path.startsWith("/icons")||path==="/logo-finanzplaner.jpeg"||path==="/manifest.webmanifest") return NextResponse.next();
  const token=request.cookies.get(SESSION_COOKIE)?.value;
  if(!token) return NextResponse.redirect(new URL("/anmelden",request.url));
  try { const session=await readSessionToken(token); if(session.mustChangePassword && path!=="/passwort-aendern") return NextResponse.redirect(new URL("/passwort-aendern",request.url)); if(path.startsWith("/admin")&&!session.isAdmin)return NextResponse.redirect(new URL("/",request.url)); return NextResponse.next(); }
  catch { const response=NextResponse.redirect(new URL("/anmelden",request.url));response.cookies.delete(SESSION_COOKIE);return response; }
}
export const config={matcher:["/((?!favicon.ico).*)"]};
