/**
 * Encryption utilities for sensitive data
 * Uses AES-256-GCM for authenticated encryption
 */

import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const key = process.env.SECRETS_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "SECRETS_ENCRYPTION_KEY is not configured. Set a 32-byte base64-encoded key."
    );
  }
  
  const decoded = Buffer.from(key, "base64");
  if (decoded.length !== KEY_LENGTH) {
    throw new Error(
      `SECRETS_ENCRYPTION_KEY must be ${KEY_LENGTH} bytes when decoded. Got ${decoded.length} bytes.`
    );
  }
  
  return decoded;
}

/**
 * Encrypt a plaintext string
 * Returns base64-encoded ciphertext with IV and auth tag appended
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv + authTag + encrypted
  const result = Buffer.concat([iv, authTag, encrypted]);
  return result.toString("base64");
}

/**
 * Decrypt a ciphertext string
 * Expects base64-encoded ciphertext with IV and auth tag
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const data = Buffer.from(ciphertext, "base64");
  
  if (data.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Invalid ciphertext: too short");
  }
  
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  
  return decrypted.toString("utf8");
}

/**
 * Check if a value appears to be encrypted (heuristic)
 * Encrypted values are base64 and longer than typical tokens
 */
export function appearsEncrypted(value: string): boolean {
  if (!value || value.length < 50) {
    return false;
  }
  
  // Check if it's valid base64
  try {
    const decoded = Buffer.from(value, "base64");
    return decoded.length >= IV_LENGTH + AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}
