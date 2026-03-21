import { httpGet } from "../../shared/http.js";
import { TtlCache } from "../../shared/cache.js";

const CNN_URL = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata";
const ALTERNATIVE_ME_URL = "https://api.alternative.me/fng/";

const CNN_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Referer": "https://www.cnn.com/markets/fear-and-greed",
};

// CNN data updates once daily — cache for 1 hour
const CACHE_TTL = 60 * 60 * 1000;
const cache = new TtlCache<unknown>(CACHE_TTL);

export interface FearGreedIndicator {
  name: string;
  score: number;
  rating: string;
}

export interface FearGreedResult {
  score: number;
  rating: string;
  previousClose: number;
  previous1Week: number;
  previous1Month: number;
  previous1Year: number;
  indicators: FearGreedIndicator[];
}

interface CnnIndicatorData {
  score: number;
  rating: string;
}

interface CnnResponse {
  fear_and_greed: {
    score: number;
    rating: string;
    previous_close: number;
    previous_1_week: number;
    previous_1_month: number;
    previous_1_year: number;
  };
  market_momentum_sp500: CnnIndicatorData;
  stock_price_strength: CnnIndicatorData;
  stock_price_breadth: CnnIndicatorData;
  put_call_options: CnnIndicatorData;
  market_volatility_vix: CnnIndicatorData;
  junk_bond_demand: CnnIndicatorData;
  safe_haven_demand: CnnIndicatorData;
}

const INDICATOR_LABELS: Record<string, string> = {
  market_momentum_sp500: "S&P 500 Momentum",
  stock_price_strength: "Stock Price Strength (52w highs vs lows)",
  stock_price_breadth: "Stock Price Breadth (McClellan Volume)",
  put_call_options: "Put/Call Ratio",
  market_volatility_vix: "Market Volatility (VIX)",
  junk_bond_demand: "Junk Bond Demand (yield spread)",
  safe_haven_demand: "Safe Haven Demand (stocks vs bonds)",
};

export async function getFearAndGreed(): Promise<FearGreedResult> {
  const cacheKey = "fear-greed";
  const cached = cache.get(cacheKey);
  if (cached) return cached as FearGreedResult;

  const data = await httpGet<CnnResponse>(CNN_URL, {
    headers: CNN_HEADERS,
  });

  const indicatorKeys = Object.keys(INDICATOR_LABELS) as Array<keyof typeof INDICATOR_LABELS>;
  const indicators: FearGreedIndicator[] = indicatorKeys.map((key) => ({
    name: INDICATOR_LABELS[key],
    score: Math.round((data as any)[key]?.score ?? 0),
    rating: (data as any)[key]?.rating ?? "unknown",
  }));

  const result: FearGreedResult = {
    score: Math.round(data.fear_and_greed.score),
    rating: data.fear_and_greed.rating,
    previousClose: Math.round(data.fear_and_greed.previous_close),
    previous1Week: Math.round(data.fear_and_greed.previous_1_week),
    previous1Month: Math.round(data.fear_and_greed.previous_1_month),
    previous1Year: Math.round(data.fear_and_greed.previous_1_year),
    indicators,
  };

  cache.set(cacheKey, result);
  return result;
}

export interface CryptoFearGreedResult {
  score: number;
  rating: string;
  timestamp: string;
}

export async function getCryptoFearAndGreed(): Promise<CryptoFearGreedResult> {
  const cacheKey = "crypto-fear-greed";
  const cached = cache.get(cacheKey);
  if (cached) return cached as CryptoFearGreedResult;

  const data = await httpGet<{
    data: Array<{
      value: string;
      value_classification: string;
      timestamp: string;
    }>;
  }>(ALTERNATIVE_ME_URL);

  const entry = data.data[0];
  const result: CryptoFearGreedResult = {
    score: parseInt(entry.value, 10),
    rating: entry.value_classification.toLowerCase(),
    timestamp: new Date(parseInt(entry.timestamp, 10) * 1000).toISOString(),
  };

  cache.set(cacheKey, result);
  return result;
}
