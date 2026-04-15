import crypto from 'crypto';

const DEFAULT_EXPIRY_SECONDS = 3600;

function getSigningKey(): string {
  const key = process.env.STORAGE_SIGNING_KEY || process.env.JWT_SECRET;
  if (!key) {
    throw new Error('STORAGE_SIGNING_KEY or JWT_SECRET is required for signed URLs');
  }
  return key;
}

export function generateSignedToken(path: string, expiresInSeconds = DEFAULT_EXPIRY_SECONDS): string {
  const key = getSigningKey();
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const payload = `${path}:${expires}`;
  const sig = crypto.createHmac('sha256', key).update(payload).digest('hex');
  return Buffer.from(JSON.stringify({ p: path, e: expires, s: sig })).toString('base64url');
}

export function verifySignedToken(token: string): { valid: boolean; path?: string } {
  try {
    const key = getSigningKey();
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    const { p: path, e: expires, s: sig } = decoded as { p: string; e: number; s: string };

    if (!path || !expires || !sig) {
      return { valid: false };
    }

    const now = Math.floor(Date.now() / 1000);
    if (now > expires) {
      return { valid: false };
    }

    const payload = `${path}:${expires}`;
    const expected = crypto.createHmac('sha256', key).update(payload).digest('hex');

    const valid = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    return valid ? { valid: true, path } : { valid: false };
  } catch {
    return { valid: false };
  }
}

export function buildSignedUrl(storagePath: string, expiresInSeconds = DEFAULT_EXPIRY_SECONDS): string {
  const token = generateSignedToken(storagePath, expiresInSeconds);
  return `/api/storage/${storagePath}?token=${token}`;
}
