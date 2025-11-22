import { NextRequest, NextResponse } from "next/server";

import { requireAccountIdFromRequest } from "@/lib/auth";
import { getDbPool } from "@/lib/db";

const SUPPORTED_JOB_TYPES = ["shopify_7d_fill", "shopify_fresh", "meta_7d_fill", "meta_fresh"] as const;
type SupportedJobType = (typeof SUPPORTED_JOB_TYPES)[number];
const SUPPORTED_JOB_TYPE_SET = new Set<SupportedJobType>(SUPPORTED_JOB_TYPES);

interface ManualSyncRequestBody {
  integration_id?: string;
  job_type?: string;
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function inferIntegrationType(jobType: string): "shopify" | "meta" | null {
  if (jobType.startsWith("shopify_")) {
    return "shopify";
  }
  if (jobType.startsWith("meta_")) {
    return "meta";
  }
  return null;
}

function isSupportedJobType(jobType: string): jobType is SupportedJobType {
  return SUPPORTED_JOB_TYPE_SET.has(jobType as SupportedJobType);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const accountId = requireAccountIdFromRequest(request);

  let body: ManualSyncRequestBody;
  try {
    body = (await request.json()) as ManualSyncRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const integrationId = normalizeString(body.integration_id);
  const jobType = normalizeString(body.job_type);

  if (!integrationId) {
    return NextResponse.json({ error: "integration_id is required." }, { status: 400 });
  }
  if (!isSupportedJobType(jobType)) {
    return NextResponse.json({ error: "job_type is invalid or unsupported." }, { status: 400 });
  }

  const pool = getDbPool();

  const integrationResult = await pool.query<{ integration_id: string; type: string }>(
    `
      SELECT integration_id, type
      FROM integrations
      WHERE integration_id = $1
        AND account_id = $2
      LIMIT 1
    `,
    [integrationId, accountId]
  );

  if (integrationResult.rowCount === 0) {
    return NextResponse.json({ error: "Integration not found for this account." }, { status: 404 });
  }

  const expectedType = inferIntegrationType(jobType);
  if (expectedType && integrationResult.rows[0].type !== expectedType) {
    return NextResponse.json(
      { error: `Integration type mismatch. Expected ${expectedType}.` },
      { status: 400 }
    );
  }

  const enqueueResult = await pool.query<{
    sync_run_id: string;
    job_type: string;
    status: string;
    trigger: string;
  }>(
    `
      INSERT INTO sync_runs (integration_id, job_type, status, trigger)
      VALUES ($1, $2, 'queued', 'user_click')
      RETURNING sync_run_id, job_type, status, trigger
    `,
    [integrationId, jobType]
  );

  const row = enqueueResult.rows[0];

  return NextResponse.json(
    {
      syncRunId: row.sync_run_id,
      jobType: row.job_type,
      status: row.status,
      trigger: row.trigger,
    },
    { status: 202, headers: { "Cache-Control": "no-store" } }
  );
}


