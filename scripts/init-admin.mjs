import postgres from "postgres";
import { hash } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL fehlt.");
const sql = postgres(url, { max: 1 });
const email = process.env.ADMIN_EMAIL?.trim() || null;
const displayName = process.env.ADMIN_DISPLAY_NAME?.trim() || "Administrator";
const existing = await sql`select id from users where lower(username) = 'admin' limit 1`;
if (existing.length) {
  await sql`update users set email = coalesce(${email}, email), display_name = ${displayName}, updated_at = now() where id = ${existing[0].id}`;
  console.log("INITIAL_ADMIN_EXISTS=1"); await sql.end(); process.exit(0);
}
const password = randomBytes(18).toString("base64url");
const passwordHash = await hash(password, { memoryCost: 19456, timeCost: 3, parallelism: 1, outputLen: 32 });
await sql`insert into users (username, display_name, email, password_hash, is_admin, must_change_password) values ('admin', ${displayName}, ${email}, ${passwordHash}, true, true)`;
console.log(`INITIAL_ADMIN_PASSWORD=${password}`);
await sql.end();
