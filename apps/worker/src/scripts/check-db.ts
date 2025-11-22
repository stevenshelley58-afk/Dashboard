import path from "path";
import dotenv from "dotenv";

const envPath = path.resolve(process.cwd(), ".env");
dotenv.config({ path: envPath, override: true });

import { getPool } from "../db.js";

async function checkDb() {
    const pool = getPool();
    const client = await pool.connect();
    try {
        console.log("Checking for tables...");
        const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
        const tables = res.rows.map(r => r.table_name);
        console.log("Tables found:", tables);

        if (tables.includes("accounts")) {
            console.log("Checking for accounts...");
            const accounts = await client.query("SELECT * FROM accounts");
            console.log("Accounts found:", accounts.rows.length);
            if (accounts.rows.length > 0) {
                console.log("First account ID:", accounts.rows[0].id);
            }
        } else {
            console.log("accounts table not found.");
        }
    } catch (err) {
        console.error("Error checking DB:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

checkDb();
