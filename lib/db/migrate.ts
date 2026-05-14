import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
config({ path: ".env.local" });
config({ path: ".env" });

import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const client = postgres(url, { max: 1, prepare: false });
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  await client.end();
  console.log("✓ Migrations applied");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
