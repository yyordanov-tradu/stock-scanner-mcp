import { httpGet } from "../../shared/http.js";
import { TtlCache } from "../../shared/cache.js";
import { calculateGreeks, calculateMaxPain } from "./greeks.js";

const BASE_URL = "https://query1.finance.yahoo.com/v7/finance/options";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new TtlCache<any>(CACHE_TTL);

// Default risk-free rate (approx 4.5% in early 2026)
const RISK_FREE_RATE = 0.045;

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
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
}

export interface OptionChain {
  underlyingSymbol: string;
  underlyingPrice: number;
  expirationDates: number[];
  strikes: number[];
  calls: OptionContract[];
  puts: OptionContract[];
  maxPain?: number;
}

export async function fetchOptionChain(
  symbol: string,
  expiration?: number
): Promise<OptionChain> {
  const cacheKey = `options:${symbol}:${expiration ?? "latest"}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let url = `${BASE_URL}/${symbol}`;
  if (expiration) {
    url += `?date=${expiration}`;
  }

  // Yahoo requires a browser-like User-Agent
  const headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };

  const response = await httpGet<any>(url, { headers });
  
  if (!response.optionChain?.result?.[0]) {
    throw new Error(`Could not find options data for symbol: ${symbol}`);
  }

  const result = response.optionChain.result[0];
  const underlyingPrice = result.quote.regularMarketPrice;
  const chain = result.options[0];
  
  const expirationTimestamp = chain.expirationDate;
  const now = Date.now() / 1000;
  const yearsToExpiration = (expirationTimestamp - now) / (365 * 24 * 60 * 60);

  const processOptions = (options: any[], isCall: boolean): OptionContract[] => {
    return options.map(opt => {
      const greeks = calculateGreeks(
        underlyingPrice,
        opt.strike,
        yearsToExpiration,
        RISK_FREE_RATE,
        opt.impliedVolatility,
        isCall
      );

      return {
        symbol: opt.contractSymbol,
        strike: opt.strike,
        lastPrice: opt.lastPrice,
        bid: opt.bid,
        ask: opt.ask,
        change: opt.change,
        percentChange: opt.percentChange,
        volume: opt.volume,
        openInterest: opt.openInterest,
        impliedVolatility: opt.impliedVolatility,
        inTheMoney: opt.inTheMoney,
        ...greeks,
      };
    });
  };

  const processedChain: OptionChain = {
    underlyingSymbol: result.underlyingSymbol,
    underlyingPrice,
    expirationDates: result.expirationDates,
    strikes: result.strikes,
    calls: processOptions(chain.calls, true),
    puts: processOptions(chain.puts, false),
  };

  processedChain.maxPain = calculateMaxPain(
    processedChain.strikes,
    processedChain.calls,
    processedChain.puts
  );

  cache.set(cacheKey, processedChain);
  return processedChain;
}
