import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";

const envPath = "c:\\Dashboard\\apps\\web\\.env.local";
dotenv.config({ path: envPath, override: true });

async function fixIntegrationStatus() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });
    const client = await pool.connect();
    try {
        const result = await client.query(`
      UPDATE integrations 
      SET status = 'connected', updated_at = NOW() 
      WHERE status = 'error' AND type = 'shopify'
      RETURNING integration_id, status
    `);
        console.log("Fixed integrations:", result.rows);
    } catch (error) {
        console.error("Error fixing integration:", error);
    } finally {
        client.release();
        await pool.end();
    }
}

fixIntegrationStatus();
