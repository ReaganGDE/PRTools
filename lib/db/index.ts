import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __pg_client__: ReturnType<typeof postgres> | undefined;
}

// postgres-js connects lazily on first query, so it's safe to instantiate
// with a placeholder URL at build time when env isn't set.
const url = process.env.DATABASE_URL ?? "postgres://placeholder@localhost/db";

const client =
  globalThis.__pg_client__ ?? postgres(url, { prepare: false, max: 5 });

if (process.env.NODE_ENV !== "production") {
  globalThis.__pg_client__ = client;
}

export const db = drizzle(client, { schema });
export { schema };
