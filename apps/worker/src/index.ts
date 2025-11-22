import path from "path";
import dotenv from "dotenv";

const envPath = path.resolve(process.cwd(), ".env");
dotenv.config({ path: envPath, override: true });

import { verifyDatabaseConnection } from "./db.js";
import { startJobDispatcher } from "./job-dispatcher.js";

async function main(): Promise<void> {
  try {
    const timestamp = await verifyDatabaseConnection();
    console.log(`DB connection ok @ ${timestamp.toISOString()}`);
    await startJobDispatcher();
  } catch (error) {
    console.error("Failed to verify database connectivity", error);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Unhandled error during worker startup", error);
  process.exitCode = 1;
});

