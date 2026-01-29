/**
 * Secrets management with encryption
 * Wraps database operations for integration_secrets with automatic encryption/decryption
 */

import { getDbPool } from "./db.js";
import { encrypt, decrypt, appearsEncrypted } from "./encryption.js";

export interface SecretRecord {
  integration_id: string;
  key: string;
  value_encrypted: string;
}

/**
 * Store a secret with automatic encryption
 * The value will be encrypted before storage if encryption is configured
 */
export async function storeSecret(
  integrationId: string,
  key: string,
  value: string
): Promise<void> {
  const pool = getDbPool();
  
  // Encrypt the value if encryption is available
  let encryptedValue: string;
  try {
    encryptedValue = encrypt(value);
  } catch (error) {
    // If encryption fails (e.g., key not configured), store plaintext
    // This maintains backward compatibility but logs a warning
    console.warn(
      `Failed to encrypt secret for integration ${integrationId}, key ${key}. ` +
      `Storing plaintext. Error: ${error}`
    );
    encryptedValue = value;
  }
  
  await pool.query(
    `
      INSERT INTO integration_secrets (integration_id, key, value_encrypted)
      VALUES ($1, $2, $3)
      ON CONFLICT (integration_id, key)
      DO UPDATE SET value_encrypted = EXCLUDED.value_encrypted,
                    updated_at = NOW()
    `,
    [integrationId, key, encryptedValue]
  );
}

/**
 * Retrieve and decrypt a secret
 * Returns null if not found
 */
export async function retrieveSecret(
  integrationId: string,
  key: string
): Promise<string | null> {
  const pool = getDbPool();
  
  const result = await pool.query<SecretRecord>(
    `
      SELECT value_encrypted
      FROM integration_secrets
      WHERE integration_id = $1
        AND key = $2
      LIMIT 1
    `,
    [integrationId, key]
  );
  
  if (result.rowCount === 0) {
    return null;
  }
  
  const encryptedValue = result.rows[0].value_encrypted;
  
  // Check if the value appears to be encrypted
  if (!appearsEncrypted(encryptedValue)) {
    // Value is plaintext, return as-is
    return encryptedValue;
  }
  
  // Attempt to decrypt
  try {
    return decrypt(encryptedValue);
  } catch (error) {
    // If decryption fails, the value might be plaintext that looks like base64
    // Return it as-is for backward compatibility
    console.warn(
      `Failed to decrypt secret for integration ${integrationId}, key ${key}. ` +
      `Returning as plaintext. Error: ${error}`
    );
    return encryptedValue;
  }
}

/**
 * Delete a secret
 */
export async function deleteSecret(
  integrationId: string,
  key: string
): Promise<void> {
  const pool = getDbPool();
  
  await pool.query(
    `
      DELETE FROM integration_secrets
      WHERE integration_id = $1
        AND key = $2
    `,
    [integrationId, key]
  );
}

/**
 * Migrate existing plaintext secrets to encrypted format
 * Call this during deployment to encrypt existing secrets
 */
export async function migrateSecretsToEncrypted(): Promise<{
  migrated: number;
  failed: number;
}> {
  const pool = getDbPool();
  
  // Get all secrets that appear to be plaintext
  const result = await pool.query<SecretRecord>(
    `
      SELECT integration_id, key, value_encrypted
      FROM integration_secrets
    `
  );
  
  let migrated = 0;
  let failed = 0;
  
  for (const row of result.rows) {
    if (appearsEncrypted(row.value_encrypted)) {
      // Already encrypted, skip
      continue;
    }
    
    try {
      const encrypted = encrypt(row.value_encrypted);
      await pool.query(
        `
          UPDATE integration_secrets
          SET value_encrypted = $1,
              updated_at = NOW()
          WHERE integration_id = $2
            AND key = $3
        `,
        [encrypted, row.integration_id, row.key]
      );
      migrated++;
    } catch (error) {
      console.error(
        `Failed to migrate secret for integration ${row.integration_id}, key ${row.key}:`,
        error
      );
      failed++;
    }
  }
  
  return { migrated, failed };
}
