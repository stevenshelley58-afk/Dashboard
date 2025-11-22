import path from "path";
import dotenv from "dotenv";
import { getPool } from "../db.js";

const envPath = path.resolve(process.cwd(), ".env");
dotenv.config({ path: envPath, override: true });

async function checkIntegrations() {
    const pool = getPool();
    const client = await pool.connect();
    try {
        console.log("Checking integrations...");
        const res = await client.query(`
      SELECT i.integration_id, i.status, s.myshopify_domain 
      FROM integrations i
      JOIN shops s ON i.shop_id = s.shop_id
    `);
        console.log("Integrations found:", res.rows);
    } catch (err) {
        console.error("Error checking integrations:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

checkIntegrations();
