import crypto from 'crypto';
import { logger } from '../config/logger';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.BILLING_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('BILLING_ENCRYPTION_KEY environment variable is required for billing data encryption');
  }
  return crypto.createHash('sha256').update(key).digest();
}

function getLegacyKey(): Buffer | null {
  const legacy = process.env.JWT_SECRET;
  if (!legacy) return null;
  return crypto.createHash('sha256').update(legacy).digest();
}

function decryptWithKey(ciphertext: string, key: Buffer): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    return ciphertext;
  }
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    return ciphertext;
  }

  try {
    return decryptWithKey(ciphertext, getEncryptionKey());
  } catch {
    const legacyKey = getLegacyKey();
    if (legacyKey) {
      try {
        const plaintext = decryptWithKey(ciphertext, legacyKey);
        logger.warn('Decrypted billing data using legacy JWT_SECRET key — re-encrypt with BILLING_ENCRYPTION_KEY');
        return plaintext;
      } catch {
        throw new Error('Failed to decrypt billing data with both current and legacy keys');
      }
    }
    throw new Error('Failed to decrypt billing data');
  }
}

export function isEncrypted(value: string): boolean {
  const parts = value.split(':');
  return parts.length === 3 && parts[0].length === IV_LENGTH * 2 && parts[1].length === AUTH_TAG_LENGTH * 2;
}
