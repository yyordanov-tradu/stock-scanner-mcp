import { TtlCache } from "../../shared/cache.js";

const BASE_URL = "https://sandbox.tradier.com/v1/markets/options";
const EXPIRATIONS_TTL = 60 * 60 * 1000; // 1 hour
const CHAIN_TTL = 2 * 60 * 1000; // 2 minutes
const TIMEOUT_MS = 10_000;

const expirationsCache = new TtlCache<string[]>(EXPIRATIONS_TTL);
const chainCache = new TtlCache<OptionContract[]>(CHAIN_TTL);

export interface OptionContract {
  symbol: string;
  strike: number;
  optionType: string;
  expiration: string;
  last: number;
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  iv: number;
}

async function tradierFetch<T>(url: string, token: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `HTTP ${response.status}: ${response.statusText} -- ${text.slice(0, 200)}`,
      );
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function getExpirations(
  token: string,
  symbol: string,
): Promise<string[]> {
  const cacheKey = `expirations:${symbol}`;
  return expirationsCache.getOrFetch(cacheKey, async () => {
    const data = await tradierFetch<{ expirations?: { date?: string[] } }>(
      `${BASE_URL}/expirations?symbol=${encodeURIComponent(symbol)}`,
      token,
    );
    return data?.expirations?.date ?? [];
  });
}

interface RawOption {
  symbol?: string;
  strike?: number;
  option_type?: string;
  expiration_date?: string;
  last?: number;
  bid?: number;
  ask?: number;
  volume?: number;
  open_interest?: number;
  greeks?: {
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
    mid_iv?: number;
  };
}

function mapOption(raw: RawOption): OptionContract {
  return {
    symbol: raw.symbol ?? "",
    strike: raw.strike ?? 0,
    optionType: raw.option_type ?? "",
    expiration: raw.expiration_date ?? "",
    last: raw.last ?? 0,
    bid: raw.bid ?? 0,
    ask: raw.ask ?? 0,
    volume: raw.volume ?? 0,
    openInterest: raw.open_interest ?? 0,
    delta: raw.greeks?.delta ?? 0,
    gamma: raw.greeks?.gamma ?? 0,
    theta: raw.greeks?.theta ?? 0,
    vega: raw.greeks?.vega ?? 0,
    iv: raw.greeks?.mid_iv ?? 0,
  };
}

export async function getOptionsChain(
  token: string,
  symbol: string,
  expiration: string,
): Promise<OptionContract[]> {
  const cacheKey = `chain:${symbol}:${expiration}`;
  return chainCache.getOrFetch(cacheKey, async () => {
    const data = await tradierFetch<{
      options?: { option?: RawOption | RawOption[] } | null;
    }>(
      `${BASE_URL}/chains?symbol=${encodeURIComponent(symbol)}&expiration=${encodeURIComponent(expiration)}&greeks=true`,
      token,
    );

    const raw = data?.options?.option;
    if (!raw) return [];

    const options = Array.isArray(raw) ? raw : [raw];
    return options.map(mapOption);
  });
}
