import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET() {
    try {
        const pool = getDbPool();
        const client = await pool.connect();
        try {
            const result = await client.query("SELECT NOW() as now");
            return NextResponse.json({ status: "ok", time: result.rows[0].now });
        } finally {
            client.release();
        }
    } catch (error) {
        return NextResponse.json(
            { status: "error", message: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
