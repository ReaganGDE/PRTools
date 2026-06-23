import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
config({ path: ".env.local" });
config({ path: ".env" });

import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // No DB configured (e.g. a local build or a preview without a database).
    // Skip rather than fail the build — runtime will surface any real issue.
    console.log("• DATABASE_URL not set — skipping migrations");
    return;
  }
  const client = postgres(url, { max: 1, prepare: false });
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  await client.end();
  console.log("✓ Migrations applied");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
