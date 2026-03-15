import { httpGet } from "../../shared/http.js";
import { TtlCache } from "../../shared/cache.js";
import { resolveTicker } from "../../shared/resolver.js";
import { calculateGreeks, calculateMaxPain } from "./greeks.js";

const BASE_URL = "https://query1.finance.yahoo.com/v7/finance/options";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new TtlCache<OptionChain>(CACHE_TTL);
const DEFAULT_RISK_FREE_RATE = 0.045;

export interface OptionContract {
  symbol: string;
  strike: number;
  lastPrice: number;
  bid: number;
  ask: number;
  change: number;
  percentChange: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  inTheMoney: boolean;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
}

export interface OptionChain {
  underlyingSymbol: string;
  underlyingPrice: number;
  expirationDates: number[];
  strikes: number[];
  calls: OptionContract[];
  puts: OptionContract[];
  maxPain: number;
}

interface YahooOptionRaw {
  contractSymbol?: string;
  strike?: number;
  lastPrice?: number;
  bid?: number;
  ask?: number;
  change?: number;
  percentChange?: number;
  volume?: number;
  openInterest?: number;
  impliedVolatility?: number;
  inTheMoney?: boolean;
}

interface YahooOptionsResponse {
  optionChain?: {
    result?: Array<{
      underlyingSymbol?: string;
      expirationDates?: number[];
      strikes?: number[];
      quote?: { regularMarketPrice?: number };
      options?: Array<{
        expirationDate?: number;
        calls?: YahooOptionRaw[];
        puts?: YahooOptionRaw[];
      }>;
    }>;
  };
}

function mapOption(
  raw: YahooOptionRaw,
  isCall: boolean,
  underlyingPrice: number,
  yearsToExpiration: number,
  riskFreeRate: number,
): OptionContract {
  const strike = raw.strike ?? 0;
  const iv = raw.impliedVolatility ?? 0;

  let greeks: { delta: number; gamma: number; theta: number; vega: number } | null = null;
  if (underlyingPrice > 0 && strike > 0 && iv > 0 && yearsToExpiration > 0) {
    greeks = calculateGreeks(underlyingPrice, strike, yearsToExpiration, riskFreeRate, iv, isCall);
  }

  return {
    symbol: raw.contractSymbol ?? "",
    strike,
    lastPrice: raw.lastPrice ?? 0,
    bid: raw.bid ?? 0,
    ask: raw.ask ?? 0,
    change: raw.change ?? 0,
    percentChange: raw.percentChange ?? 0,
    volume: raw.volume ?? 0,
    openInterest: raw.openInterest ?? 0,
    impliedVolatility: iv,
    inTheMoney: raw.inTheMoney ?? false,
    delta: greeks?.delta ?? null,
    gamma: greeks?.gamma ?? null,
    theta: greeks?.theta ?? null,
    vega: greeks?.vega ?? null,
  };
}

export async function fetchOptionChain(
  rawSymbol: string,
  expiration?: number,
  riskFreeRate = DEFAULT_RISK_FREE_RATE,
): Promise<OptionChain> {
  const { ticker } = resolveTicker(rawSymbol);
  const cacheKey = `options:${ticker}:${expiration ?? "latest"}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let url = `${BASE_URL}/${encodeURIComponent(ticker)}`;
  if (expiration) {
    url += `?date=${expiration}`;
  }

  const response = await httpGet<YahooOptionsResponse>(url);

  const result = response?.optionChain?.result?.[0];
  if (!result) {
    throw new Error(`No options data found for symbol: ${ticker}`);
  }

  const underlyingPrice = result.quote?.regularMarketPrice;
  if (!underlyingPrice) {
    throw new Error(`No price data available for symbol: ${ticker}`);
  }

  const chainData = result.options?.[0];
  if (!chainData) {
    throw new Error(`No option contracts found for symbol: ${ticker}`);
  }

  const expirationTimestamp = chainData.expirationDate ?? 0;
  const now = Date.now() / 1000;
  const yearsToExpiration = Math.max((expirationTimestamp - now) / (365 * 24 * 60 * 60), 0);

  const calls = (chainData.calls ?? []).map(opt => mapOption(opt, true, underlyingPrice, yearsToExpiration, riskFreeRate));
  const puts = (chainData.puts ?? []).map(opt => mapOption(opt, false, underlyingPrice, yearsToExpiration, riskFreeRate));
  const strikes = result.strikes ?? [];

  const processedChain: OptionChain = {
    underlyingSymbol: result.underlyingSymbol ?? ticker,
    underlyingPrice,
    expirationDates: result.expirationDates ?? [],
    strikes,
    calls,
    puts,
    maxPain: calculateMaxPain(strikes, calls, puts),
  };

  cache.set(cacheKey, processedChain);
  return processedChain;
}
