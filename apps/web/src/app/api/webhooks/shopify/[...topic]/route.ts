import type { PoolClient } from "pg";
import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import {
  getWebhookTopics,
  normalizeShopDomain,
  verifyShopifyWebhookHmac,
} from "@/lib/shopify";

const SUPPORTED_TOPICS = new Set(getWebhookTopics());
const WEBHOOK_DB_TIMEOUT_MS = (() => {
  const parsed = Number(process.env.SHOPIFY_WEBHOOK_DB_TIMEOUT_MS ?? "4000");
  return Number.isFinite(parsed) ? parsed : 4000;
})();

async function getIntegrationIdForShop(
  client: PoolClient,
  shopDomain: string
): Promise<string> {
  const result = await client.query<{ integration_id: string }>(
    `
      SELECT i.integration_id
      FROM shops s
      INNER JOIN integrations i ON i.shop_id = s.shop_id
      WHERE s.myshopify_domain = $1
        AND i.type = 'shopify'
      ORDER BY i.updated_at DESC NULLS LAST
      LIMIT 1
    `,
    [shopDomain]
  );

  if (result.rowCount === 0) {
    throw new Error(`No Shopify integration found for shop ${shopDomain}`);
  }

  return result.rows[0].integration_id;
}

async function saveRawWebhook(params: {
  shopDomain: string;
  topic: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL statement_timeout = ${WEBHOOK_DB_TIMEOUT_MS}`);

    const integrationId = await getIntegrationIdForShop(client, params.shopDomain);

    await client.query(
      `
        INSERT INTO shopify_webhooks_raw (integration_id, topic, received_at, payload_json)
        VALUES ($1, $2, NOW(), $3::jsonb)
      `,
      [integrationId, params.topic, JSON.stringify(params.payload)]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ topic: string[] }> }
): Promise<NextResponse> {
  const params = await context.params;
  const topic = (params.topic ?? []).join("/");

  if (!SUPPORTED_TOPICS.has(topic)) {
    return NextResponse.json({ error: "unsupported topic" }, { status: 404 });
  }

  const shopHeader = request.headers.get("x-shopify-shop-domain");
  const hmacHeader = request.headers.get("x-shopify-hmac-sha256");

  if (!shopHeader || !hmacHeader) {
    return NextResponse.json(
      { error: "Missing Shopify webhook headers." },
      { status: 400 }
    );
  }

  const rawBody = await request.text();

  if (!verifyShopifyWebhookHmac(rawBody, hmacHeader)) {
    return NextResponse.json(
      { error: "Invalid webhook signature." },
      { status: 401 }
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const shopDomain = normalizeShopDomain(shopHeader);

  try {
    await saveRawWebhook({
      shopDomain,
      topic,
      payload,
    });
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("Failed to persist Shopify webhook", error);
    return NextResponse.json(
      { error: "Failed to store webhook payload." },
      { status: 500 }
    );
  }
}


