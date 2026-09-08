import postgres from "postgres";
import { hash } from "@node-rs/argon2";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL fehlt.");
const databaseName = new URL(databaseUrl).pathname.slice(1);
if (!/(^|_)test($|_)/i.test(databaseName)) throw new Error(`E2E-Seed ist ausschließlich für eine Testdatenbank erlaubt, nicht für „${databaseName}“.`);

const sql = postgres(databaseUrl, { max: 1 });
const passwordHash = await hash("Finanzplaner-Test-2026", { memoryCost: 19456, timeCost: 3, parallelism: 1, outputLen: 32 });
await sql.begin(async (tx) => {
  await tx`truncate table users, households, system_settings restart identity cascade`;
  const [user] = await tx`insert into users (username, display_name, email, password_hash, is_admin, must_change_password) values ('e2e-admin', 'E2E Administrator', 'e2e@example.invalid', ${passwordHash}, true, false) returning id`;
  const [household] = await tx`insert into households (name) values ('Testfamilie') returning id`;
  const [member] = await tx`insert into household_members (household_id, user_id, display_name, kind) values (${household.id}, ${user.id}, 'E2E Administrator', 'adult') returning id`;
  await tx`insert into accounts (household_id, owner_member_id, name, kind, currency) values (${household.id}, ${member.id}, 'Test-Girokonto', 'personal', 'EUR')`;
  await tx`insert into categories (household_id, name, slug, color, icon, is_income, sort_order) values (${household.id}, 'Lebensmittel', 'lebensmittel', '#238c87', 'ShoppingBasket', false, 1)`;
  const config = {
    delimiter: ";", encoding: "utf-8-sig", headerRow: 1, skipEmptyLines: true,
    dateFormat: "dd.MM.yyyy", decimalSeparator: ",",
    columns: { account: "Auftragskonto", bookedOn: "Buchungstag", valuedOn: "Valutadatum", bookingType: "Buchungstext", purpose: "Verwendungszweck", counterparty: "Beguenstigter/Zahlungspflichtiger", amount: "Betrag", currency: "Waehrung", endToEndReference: "Kundenreferenz (End-to-End)" },
    requiredFields: ["account", "bookedOn", "amount", "currency"],
  };
  await tx`insert into import_templates (household_id, name, bank_name, enabled, builtin, tested_at, created_by, config) values (${household.id}, 'Sparkasse CSV-CAMT V8', 'Sparkasse', true, true, now(), ${user.id}, ${sql.json(config)})`;
});
await sql.end();
console.log("E2E_TEST_USER=e2e-admin");
console.log("E2E_TEST_PASSWORD=Finanzplaner-Test-2026");
