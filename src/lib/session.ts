import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "finanzplaner_session";
export interface SessionPayload { userId: string; username: string; isAdmin: boolean; mustChangePassword: boolean }
function key() { const secret=process.env.AUTH_SECRET; if(!secret) throw new Error("AUTH_SECRET fehlt."); return new TextEncoder().encode(secret); }
export async function createSessionToken(payload:SessionPayload){return new SignJWT({ ...payload }).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("12h").sign(key())}
export async function readSessionToken(token:string){const result=await jwtVerify(token,key(),{algorithms:["HS256"]});return result.payload as unknown as SessionPayload}
