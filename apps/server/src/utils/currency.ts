import { logger } from '../config/logger';

const BASE_PRICE_USD = 3.99;

let cachedRate: { rate: number; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FALLBACK_RATE = 1450;

async function fetchExchangeRate(): Promise<number> {
  if (cachedRate && Date.now() - cachedRate.fetchedAt < CACHE_TTL_MS) {
    return cachedRate.rate;
  }

  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as { result: string; rates?: Record<string, number> };
    if (data.result === 'success' && data.rates?.KRW) {
      const rate = data.rates.KRW;
      cachedRate = { rate, fetchedAt: Date.now() };
      logger.info({ rate }, 'Exchange rate updated (USD→KRW)');
      return rate;
    }
    throw new Error('Invalid API response');
  } catch (error) {
    logger.warn({ error: error instanceof Error ? error.message : String(error), fallbackRate: FALLBACK_RATE }, 'Failed to fetch exchange rate, using fallback');
    if (cachedRate) return cachedRate.rate;
    return FALLBACK_RATE;
  }
}

export async function getKRWPrice(): Promise<number> {
  const rate = await fetchExchangeRate();
  const rawPrice = BASE_PRICE_USD * rate;
  const rounded = Math.round(rawPrice / 100) * 100;
  return rounded;
}

export function getBasePriceUSD(): number {
  return BASE_PRICE_USD;
}

export async function getExchangeInfo(): Promise<{ usd: number; krw: number; rate: number }> {
  const rate = await fetchExchangeRate();
  const krw = Math.round(BASE_PRICE_USD * rate / 100) * 100;
  return { usd: BASE_PRICE_USD, krw, rate: Math.round(rate * 100) / 100 };
}
