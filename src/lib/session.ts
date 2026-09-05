import { SignJWT, jwtVerify } from "jose";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export const SESSION_COOKIE = "finanzplaner_session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;
export interface SessionPayload { userId: string; username: string; isAdmin: boolean; mustChangePassword: boolean }
function key() { const secret=process.env.AUTH_SECRET; if(!secret) throw new Error("AUTH_SECRET fehlt."); return new TextEncoder().encode(secret); }
export const sessionCookieOptions: Partial<ResponseCookie> = {
  httpOnly: true,
  sameSite: "lax",
  secure: false,
  path: "/",
  maxAge: SESSION_DURATION_SECONDS,
};
export async function createSessionToken(payload:SessionPayload){return new SignJWT({ ...payload }).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime(`${SESSION_DURATION_SECONDS}s`).sign(key())}
export async function readSessionToken(token:string){const result=await jwtVerify(token,key(),{algorithms:["HS256"]});return result.payload as unknown as SessionPayload}
