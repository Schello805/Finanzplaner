import "server-only";
import { cookies } from "next/headers";
import { readSessionToken, SESSION_COOKIE } from "./session";

export async function currentUser() {
  const token=(await cookies()).get(SESSION_COOKIE)?.value;
  if(!token) return null;
  return readSessionToken(token).catch(()=>null);
}

export async function requireUser(){const user=await currentUser();if(!user)throw new Error("Nicht angemeldet.");return user}
export async function requireAdmin(){const user=await requireUser();if(!user.isAdmin)throw new Error("Administratorrechte erforderlich.");return user}
