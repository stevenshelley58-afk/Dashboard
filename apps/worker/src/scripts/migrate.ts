import path from "path";
import fs from "fs/promises";
import dotenv from "dotenv";

import { getPool } from "../db.js";

const envPath = path.resolve(process.cwd(), ".env");
dotenv.config({ path: envPath, override: true });

async function applyMigrations(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const migrationsDir = path.resolve(process.cwd(), "../../db/migrations");
    const entries = (await fs.readdir(migrationsDir))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    if (entries.length === 0) {
      console.warn(`No .sql files found in ${migrationsDir}`);
      return;
    }

    console.log(`Applying ${entries.length} migration(s) from ${migrationsDir}`);

    for (const file of entries) {
      const fullPath = path.join(migrationsDir, file);
      const sql = await fs.readFile(fullPath, "utf8");
      if (!sql.trim()) {
        continue;
      }

      console.log(`\n→ ${file}`);
      await client.query(sql);
      console.log(`   Applied ${file}`);
    }

    console.log("\nAll migrations applied successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigrations().catch((error) => {
  console.error("Unhandled migration error", error);
  process.exitCode = 1;
});
