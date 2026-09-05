import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";

export async function hashPassword(password: string) {
  return hash(password, { memoryCost: 19456, timeCost: 3, parallelism: 1, outputLen: 32 });
}

export async function verifyPassword(passwordHash: string, password: string) {
  return verify(passwordHash, password);
}

export function validatePassword(password: string) {
  const issues: string[] = [];
  if (password.length < 8) issues.push("Das Passwort muss mindestens 8 Zeichen lang sein.");
  if (password.length > 128) issues.push("Das Passwort darf höchstens 128 Zeichen lang sein.");
  return issues;
}

function encryptionKey() {
  const configured = process.env.ENCRYPTION_KEY;
  if (!configured) throw new Error("ENCRYPTION_KEY ist nicht gesetzt.");
  const key = Buffer.from(configured, "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY muss 32 Byte Base64-kodiert sein.");
  return key;
}

export function encryptSecret(plaintext: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSecret(payload: string) {
  try {
    const [version, ivText, tagText, dataText] = payload.split(".");
    if (version !== "v1" || !ivText || !tagText || !dataText) throw new Error("invalid payload");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(dataText, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Gespeicherte verschlüsselte Daten können mit dem aktuellen Systemschlüssel nicht gelesen werden.");
  }
}

export function stablePrivateFingerprint(value: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET ist nicht gesetzt.");
  return createHash("sha256").update(`${secret}:${value.replace(/\s/g, "").toUpperCase()}`).digest("hex");
}

export type PwnedCheck = { status: "safe" | "pwned" | "unavailable"; occurrences?: number };
export async function checkPwnedPassword(password: string): Promise<PwnedCheck> {
  const digest = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = digest.slice(0, 5);
  const suffix = digest.slice(5);
  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, { headers: { "Add-Padding": "true", "User-Agent": "Finanzplaner" }, signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!response.ok) return { status: "unavailable" };
    const found = (await response.text()).split("\n").map(line => line.trim().split(":"))
      .find(([hashSuffix]) => hashSuffix === suffix);
    return found ? { status: "pwned", occurrences: Number(found[1]) } : { status: "safe" };
  } catch { return { status: "unavailable" }; }
}

export function generateInitialPassword() { return randomBytes(18).toString("base64url"); }
