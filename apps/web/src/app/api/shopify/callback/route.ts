import type { PoolClient } from "pg";
import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import {
  ensureShopifyWebhooks,
  exchangeCodeForAccessToken,
  fetchShopDetails,
  getAppSettingsUrl,
  normalizeShopDomain,
  parseShopifyStateToken,
  verifyShopifyOAuthHmac,
  type ShopifyShopDetails,
} from "@/lib/shopify";

async function enforceAccountCurrency(
  client: PoolClient,
  accountId: string,
  currency?: string
): Promise<void> {
  if (!currency) {
    return;
  }

  const result = await client.query<{ currency: string | null }>(
    `SELECT currency FROM accounts WHERE account_id = $1 FOR UPDATE`,
    [accountId]
  );

  if (result.rowCount === 0) {
    throw new Error(`Account ${accountId} not found.`);
  }

  const existingCurrency = result.rows[0].currency;

  if (existingCurrency && existingCurrency !== currency) {
    throw new Error(
      `Account currency ${existingCurrency} does not match Shopify currency ${currency}.`
    );
  }

  if (!existingCurrency) {
    await client.query(
      `
        UPDATE accounts
        SET currency = $2,
            currency_locked_at = NOW(),
            currency_locked_by = 'shopify'
        WHERE account_id = $1
      `,
      [accountId, currency]
    );
  }
}

async function upsertShop(
  client: PoolClient,
  accountId: string,
  details: ShopifyShopDetails
): Promise<string> {
  // Check if shop exists (using the functional index condition)
  const existing = await client.query<{ shop_id: string }>(
    `SELECT shop_id FROM shops WHERE LOWER(myshopify_domain) = LOWER($1)`,
    [details.myshopifyDomain]
  );

  if (existing.rowCount != null && existing.rowCount > 0) {
    // Update existing shop
    const shopId = existing.rows[0].shop_id;
    await client.query(
      `
        UPDATE shops
        SET account_id = $2,
            shopify_gid = $3,
            shop_name = $4,
            currency = COALESCE($5, currency),
            timezone = COALESCE($6, timezone),
            status = 'active'
        WHERE shop_id = $1
      `,
      [
        shopId,
        accountId,
        details.shopifyGid ?? null,
        details.name ?? null,
        details.currency ?? null,
        details.timezone ?? null,
      ]
    );
    return shopId;
  } else {
    // Insert new shop
    const result = await client.query<{ shop_id: string }>(
      `
        INSERT INTO shops (account_id, myshopify_domain, shopify_gid, shop_name, currency, timezone, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'active')
        RETURNING shop_id
      `,
      [
        accountId,
        details.myshopifyDomain,
        details.shopifyGid ?? null,
        details.name ?? null,
        details.currency ?? null,
        details.timezone ?? null,
      ]
    );
    return result.rows[0].shop_id;
  }
}

async function upsertIntegration(
  client: PoolClient,
  accountId: string,
  shopId: string
): Promise<string> {
  const existing = await client.query<{ integration_id: string }>(
    `
      SELECT integration_id
      FROM integrations
      WHERE account_id = $1
        AND type = 'shopify'
      FOR UPDATE
    `,
    [accountId]
  );

  if (existing.rowCount != null && existing.rowCount > 0) {
    const integrationId = existing.rows[0].integration_id;
    await client.query(
      `
        UPDATE integrations
        SET shop_id = $2,
            status = 'connected',
            updated_at = NOW()
        WHERE integration_id = $1
      `,
      [integrationId, shopId]
    );
    return integrationId;
  }

  const inserted = await client.query<{ integration_id: string }>(
    `
      INSERT INTO integrations (account_id, type, shop_id, status)
      VALUES ($1, 'shopify', $2, 'connected')
      RETURNING integration_id
    `,
    [accountId, shopId]
  );

  return inserted.rows[0].integration_id;
}

async function storeAccessToken(
  client: PoolClient,
  integrationId: string,
  accessToken: string
): Promise<void> {
  await client.query(
    `
      INSERT INTO integration_secrets (integration_id, key, value_encrypted)
      VALUES ($1, 'shopify_offline_token', $2)
      ON CONFLICT (integration_id, key)
      DO UPDATE SET
        value_encrypted = EXCLUDED.value_encrypted,
        updated_at = NOW()
    `,
    [integrationId, accessToken]
  );
}

async function persistShopifyInstall(params: {
  accountId: string;
  shopDetails: ShopifyShopDetails;
  accessToken: string;
}): Promise<{ integrationId: string; shopDomain: string }> {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    console.log("Starting persistShopifyInstall", { accountId: params.accountId, shop: params.shopDetails.myshopifyDomain });
    await client.query("BEGIN");

    await enforceAccountCurrency(
      client,
      params.accountId,
      params.shopDetails.currency
    );
    console.log("Currency enforced");

    const shopId = await upsertShop(client, params.accountId, params.shopDetails);
    console.log("Shop upserted", { shopId });

    const integrationId = await upsertIntegration(
      client,
      params.accountId,
      shopId
    );
    console.log("Integration upserted", { integrationId });

    await storeAccessToken(client, integrationId, params.accessToken);
    console.log("Token stored");

    await client.query("COMMIT");
    console.log("Transaction committed");

    return { integrationId, shopDomain: params.shopDetails.myshopifyDomain };
  } catch (error) {
    console.error("Error in persistShopifyInstall", error);
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const params = request.nextUrl.searchParams;
    const code = params.get("code");
    const hmac = params.get("hmac");
    const shopParam = params.get("shop");
    const stateParam = params.get("state");

    if (!code || !hmac || !shopParam || !stateParam) {
      return NextResponse.json(
        { error: "Missing Shopify OAuth parameters." },
        { status: 400 }
      );
    }

    if (!verifyShopifyOAuthHmac(params)) {
      return NextResponse.json(
        { error: "Shopify callback HMAC verification failed." },
        { status: 400 }
      );
    }

    const normalizedShop = normalizeShopDomain(shopParam);
    const statePayload = parseShopifyStateToken(stateParam);

    if (!statePayload || statePayload.shopDomain !== normalizedShop) {
      return NextResponse.json(
        { error: "Invalid or expired Shopify OAuth state." },
        { status: 400 }
      );
    }

    const { accessToken } = await exchangeCodeForAccessToken(
      normalizedShop,
      code
    );
    const shopDetails = await fetchShopDetails(normalizedShop, accessToken);

    await persistShopifyInstall({
      accountId: statePayload.accountId,
      shopDetails,
      accessToken,
    });

    try {
      await ensureShopifyWebhooks(normalizedShop, accessToken);
    } catch (error) {
      // For local dev, webhooks might fail if not tunneled. 
      // We log it but don't fail the installation.
      console.warn("Failed to register Shopify webhooks (non-fatal)", error);
      // Do NOT update status to error. Keep it connected.
    }

    const redirectTarget = getAppSettingsUrl("?shopify=connected");
    return NextResponse.redirect(redirectTarget);
  } catch (error) {
    console.error("Shopify OAuth callback failed", error);
    const errorLog = {
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      errorType: error?.constructor?.name,
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
    };

    try {
      const fs = await import('fs');
      // Use a hardcoded path to be sure
      const logPath = 'c:\\Dashboard\\install-error.json';
      fs.writeFileSync(logPath, JSON.stringify(errorLog, null, 2));
      console.log("Error log written to", logPath);
    } catch (fsError) {
      console.error("Failed to write error log", fsError);
    }

    return NextResponse.json(
      { error: "Unable to complete Shopify installation." },
      { status: 500 }
    );
  }
}

