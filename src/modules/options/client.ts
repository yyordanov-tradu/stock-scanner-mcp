import { TtlCache } from "../../shared/cache.js";
import { httpGet } from "../../shared/http.js";

const DEFAULT_BASE_URL = "https://sandbox.tradier.com/v1/markets/options";
const EXPIRATIONS_TTL = 60 * 60 * 1000; // 1 hour
const CHAIN_TTL = 2 * 60 * 1000; // 2 minutes

const expirationsCache = new TtlCache<string[]>(EXPIRATIONS_TTL);
const chainCache = new TtlCache<OptionContract[]>(CHAIN_TTL);

export function getBaseUrl(): string {
  return process.env.TRADIER_BASE_URL || DEFAULT_BASE_URL;
}

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
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  iv: number | null;
}

function tradierHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
}

export async function getExpirations(
  token: string,
  symbol: string,
): Promise<string[]> {
  const cacheKey = `expirations:${symbol}`;
  return expirationsCache.getOrFetch(cacheKey, async () => {
    const data = await httpGet<{ expirations?: { date?: string[] } }>(
      `${getBaseUrl()}/expirations?symbol=${encodeURIComponent(symbol)}`,
      { headers: tradierHeaders(token) },
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
    delta: raw.greeks?.delta ?? null,
    gamma: raw.greeks?.gamma ?? null,
    theta: raw.greeks?.theta ?? null,
    vega: raw.greeks?.vega ?? null,
    iv: raw.greeks?.mid_iv ?? null,
  };
}

export async function getOptionsChain(
  token: string,
  symbol: string,
  expiration: string,
): Promise<OptionContract[]> {
  const cacheKey = `chain:${symbol}:${expiration}`;
  return chainCache.getOrFetch(cacheKey, async () => {
    const data = await httpGet<{
      options?: { option?: RawOption | RawOption[] } | null;
    }>(
      `${getBaseUrl()}/chains?symbol=${encodeURIComponent(symbol)}&expiration=${encodeURIComponent(expiration)}&greeks=true`,
      { headers: tradierHeaders(token) },
    );

    const raw = data?.options?.option;
    if (!raw) return [];

    const options = Array.isArray(raw) ? raw : [raw];
    return options.map(mapOption);
  });
}
