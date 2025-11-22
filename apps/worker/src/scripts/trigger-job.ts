import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";

const envPath = "c:\\Dashboard\\apps\\web\\.env.local";
dotenv.config({ path: envPath, override: true });

async function triggerJob() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });
    const client = await pool.connect();
    try {
        // Get the first shopify integration
        const integrationRes = await client.query(
            "SELECT integration_id FROM integrations WHERE type = 'shopify' LIMIT 1"
        );

        if (integrationRes.rowCount === 0) {
            console.error("No Shopify integration found");
            return;
        }

        const integrationId = integrationRes.rows[0].integration_id;

        // Insert job
        const res = await client.query(
            `
      INSERT INTO sync_runs (integration_id, job_type, status, trigger)
      VALUES ($1, 'shopify_7d_fill', 'queued', 'manual')
      RETURNING sync_run_id
      `,
            [integrationId]
        );

        console.log("Triggered job:", res.rows[0].sync_run_id);

    } catch (error) {
        console.error("Error triggering job:", error);
    } finally {
        client.release();
        await pool.end();
    }
}

triggerJob();
