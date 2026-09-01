import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Eine Platzhalter-URL erlaubt den statischen Produktions-Build. Erst bei einer
// tatsächlichen Datenbankanfrage wird eine Verbindung hergestellt; Installation
// und Laufzeit setzen DATABASE_URL verbindlich über /etc/finanzplaner.env.
const url = process.env.DATABASE_URL ?? "postgresql://127.0.0.1:5432/finanzplaner_build_only";

const client = postgres(url, { max: 10, idle_timeout: 20, prepare: false });
export const db = drizzle(client, { schema });
