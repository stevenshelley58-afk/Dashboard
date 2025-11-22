import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";

const envPath = "c:\\Dashboard\\apps\\web\\.env.local";
dotenv.config({ path: envPath, override: true });

async function checkJob() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });
    const client = await pool.connect();
    try {
        const res = await client.query(
            "SELECT * FROM sync_runs ORDER BY created_at DESC LIMIT 1"
        );
        console.log("Latest Job:", res.rows[0]);

        if (res.rows[0]?.status === 'success') {
            const orders = await client.query("SELECT COUNT(*) FROM fact_orders");
            console.log("Fact Orders Count:", orders.rows[0].count);

            const metrics = await client.query("SELECT * FROM daily_shopify_metrics LIMIT 5");
            console.log("Metrics Sample:", metrics.rows);
        }

    } catch (error) {
        console.error("Error checking job:", error);
    } finally {
        client.release();
        await pool.end();
    }
}

checkJob();
