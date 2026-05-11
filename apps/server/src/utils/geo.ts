import type { Request } from 'express';
import { logger } from '../config/logger';

const COUNTRY_CACHE = new Map<string, { country: string | null; at: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;
const LOOKUP_TIMEOUT_MS = 1500;

const PAYPAL_RECURRING_BLOCKED_COUNTRIES = new Set(['IN']);

function normalize(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const upper = value.trim().toUpperCase();
  if (!upper || upper.length !== 2) return null;
  return upper;
}

function pickHeaderCountry(req: Request): string | null {
  const candidates = [
    req.headers['cf-ipcountry'],
    req.headers['x-vercel-ip-country'],
    req.headers['x-replit-user-country'],
    req.headers['x-country-code'],
    req.headers['x-appengine-country'],
  ];
  for (const c of candidates) {
    const v = Array.isArray(c) ? c[0] : c;
    const norm = normalize(v);
    if (norm && norm !== 'XX') return norm;
  }
  return null;
}

function pickClientIp(req: Request): string | null {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim();
  }
  return req.ip || null;
}

async function lookupCountryByIp(ip: string): Promise<string | null> {
  const cached = COUNTRY_CACHE.get(ip);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.country;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
    const res = await fetch(`https://api.country.is/${encodeURIComponent(ip)}`, {
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok) {
      COUNTRY_CACHE.set(ip, { country: null, at: Date.now() });
      return null;
    }
    const data = (await res.json()) as { country?: string };
    const country = normalize(data.country);
    COUNTRY_CACHE.set(ip, { country, at: Date.now() });
    return country;
  } catch (err) {
    logger.debug(
      { ip, error: err instanceof Error ? err.message : String(err) },
      'IP geolocation lookup failed',
    );
    COUNTRY_CACHE.set(ip, { country: null, at: Date.now() });
    return null;
  }
}

/**
 * 사용자 위치를 식별한다. 우선순위:
 *   1) 명시적 override (req.body.countryOverride / ?country=XX)
 *   2) 프록시 헤더 (cf-ipcountry 등)
 *   3) IP 기반 외부 조회 (api.country.is, 1초 timeout)
 * 실패 시 null. ISO-3166-1 alpha-2 대문자.
 */
export async function detectCountry(req: Request): Promise<string | null> {
  // override 는 비프로덕션(테스트)에서만 허용 — 운영에서는 사용자가 인도 분기를 임의 트리거하지 못하도록 차단.
  if (process.env.NODE_ENV !== 'production' || process.env.ALLOW_GEO_OVERRIDE === '1') {
    const overrideRaw =
      (req.body && typeof req.body === 'object' && (req.body as Record<string, unknown>).countryOverride) ||
      req.query?.country;
    const override = normalize(overrideRaw);
    if (override) return override;
  }

  const headerCountry = pickHeaderCountry(req);
  if (headerCountry) return headerCountry;

  const ip = pickClientIp(req);
  if (!ip) return null;
  return await lookupCountryByIp(ip);
}

/** PayPal 정기 구독이 사실상 작동하지 않는 국가 (RBI 규제 등) */
export function isPayPalRecurringBlocked(country: string | null | undefined): boolean {
  if (!country) return false;
  return PAYPAL_RECURRING_BLOCKED_COUNTRIES.has(country.toUpperCase());
}
