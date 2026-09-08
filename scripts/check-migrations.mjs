import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

const migrationDirectory = join(process.cwd(), "drizzle");
const journalPath = join(migrationDirectory, "meta", "_journal.json");
const journal = JSON.parse(readFileSync(journalPath, "utf8"));
const entries = journal.entries ?? [];
const sqlTags = readdirSync(migrationDirectory)
  .filter((name) => name.endsWith(".sql"))
  .map((name) => basename(name, ".sql"))
  .sort();

if (entries.length !== sqlTags.length) {
  throw new Error(`Migrationsjournal und SQL-Dateien unterscheiden sich: ${entries.length} Einträge, ${sqlTags.length} Dateien.`);
}

const tags = new Set();
for (const [position, entry] of entries.entries()) {
  if (entry.idx !== position) throw new Error(`Migration „${entry.tag}“ hat Index ${entry.idx}, erwartet wurde ${position}.`);
  if (tags.has(entry.tag)) throw new Error(`Migration „${entry.tag}“ ist doppelt im Journal vorhanden.`);
  tags.add(entry.tag);
  if (!existsSync(join(migrationDirectory, `${entry.tag}.sql`))) throw new Error(`SQL-Datei für Migration „${entry.tag}“ fehlt.`);
  if (position > 0 && Number(entry.when) <= Number(entries[position - 1].when)) {
    throw new Error(`Migration „${entry.tag}“ hat keinen neueren Zeitstempel als „${entries[position - 1].tag}“. Drizzle würde sie überspringen.`);
  }
}

for (const tag of sqlTags) if (!tags.has(tag)) throw new Error(`SQL-Datei „${tag}.sql“ fehlt im Migrationsjournal.`);
console.log(`${entries.length} Migrationen sind vollständig und streng chronologisch sortiert.`);
