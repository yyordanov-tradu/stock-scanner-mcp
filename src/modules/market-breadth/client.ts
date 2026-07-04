import { scanStocks } from "../tradingview/scanner.js";
import { TtlCache } from "../../shared/cache.js";

export type MarketBreadthUniverse = "major_us" | "both" | "NYSE" | "NASDAQ" | "AMEX";

export interface MarketBreadthOptions {
  universe?: MarketBreadthUniverse;
  limit?: number;
  newHighLowThresholdPct?: number;
}

export interface MarketBreadthResult {
  universe: MarketBreadthUniverse;
  exchanges: string[];
  sampleSize: number;
  advanceDecline: {
    advancers: number;
    decliners: number;
    unchanged: number;
    ratio: number | null;
    advancePercent: number;
    declinePercent: number;
  };
  movingAverages: {
    aboveSma50: number;
    sma50Denominator: number;
    aboveSma50Percent: number;
    aboveSma200: number;
    sma200Denominator: number;
    aboveSma200Percent: number;
  };
  newHighsLows: {
    newHighs: number;
    newLows: number;
    thresholdPct: number;
    denominator: number;
  };
  metadata: {
    source: string;
    dataDelay: string;
    asOf: string;
  };
}

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const cache = new TtlCache<MarketBreadthResult>(CACHE_TTL);

export function aggregateMarketBreadth(
  rows: Array<{ s: string; data: Record<string, any> }>,
  options: Required<MarketBreadthOptions>
): Omit<MarketBreadthResult, "universe" | "exchanges" | "metadata"> {
  let advancers = 0;
  let decliners = 0;
  let unchanged = 0;
  let adDenominator = 0;

  let aboveSma50 = 0;
  let sma50Denominator = 0;

  let aboveSma200 = 0;
  let sma200Denominator = 0;

  let newHighs = 0;
  let newLows = 0;
  let hlDenominator = 0;

  const threshold = options.newHighLowThresholdPct;

  for (const row of rows) {
    const d = row.data;
    const close = d.close != null ? Number(d.close) : null;
    const change = d.change != null ? Number(d.change) : null;
    
    // Support either case for 52-week High/Low
    const high52 = d["High.52Week"] != null ? Number(d["High.52Week"]) : 
                   d["High.52week"] != null ? Number(d["High.52week"]) : null;
    const low52 = d["Low.52Week"] != null ? Number(d["Low.52Week"]) : 
                  d["Low.52week"] != null ? Number(d["Low.52week"]) : null;

    const sma50 = d.SMA50 != null ? Number(d.SMA50) : null;
    const sma200 = d.SMA200 != null ? Number(d.SMA200) : null;

    // 1. Advance / Decline
    if (close !== null && change !== null && !isNaN(close) && !isNaN(change)) {
      adDenominator++;
      if (change > 0) {
        advancers++;
      } else if (change < 0) {
        decliners++;
      } else {
        unchanged++;
      }
    }

    // 2. SMAs
    if (close !== null && sma50 !== null && !isNaN(close) && !isNaN(sma50)) {
      sma50Denominator++;
      if (close > sma50) {
        aboveSma50++;
      }
    }

    if (close !== null && sma200 !== null && !isNaN(close) && !isNaN(sma200)) {
      sma200Denominator++;
      if (close > sma200) {
        aboveSma200++;
      }
    }

    // 3. New Highs / Lows
    if (close !== null && high52 !== null && low52 !== null && !isNaN(close) && !isNaN(high52) && !isNaN(low52)) {
      hlDenominator++;
      const highThreshold = high52 * (1 - threshold / 100);
      const lowThreshold = low52 * (1 + threshold / 100);

      if (close >= highThreshold) {
        newHighs++;
      }
      if (close <= lowThreshold) {
        newLows++;
      }
    }
  }

  const ratio = decliners > 0 ? Math.round((advancers / decliners) * 100) / 100 : null;
  const advancePercent = adDenominator > 0 ? Math.round((advancers / adDenominator) * 10000) / 100 : 0;
  const declinePercent = adDenominator > 0 ? Math.round((decliners / adDenominator) * 10000) / 100 : 0;

  const aboveSma50Percent = sma50Denominator > 0 ? Math.round((aboveSma50 / sma50Denominator) * 10000) / 100 : 0;
  const aboveSma200Percent = sma200Denominator > 0 ? Math.round((aboveSma200 / sma200Denominator) * 10000) / 100 : 0;

  return {
    sampleSize: adDenominator,
    advanceDecline: {
      advancers,
      decliners,
      unchanged,
      ratio,
      advancePercent,
      declinePercent,
    },
    movingAverages: {
      aboveSma50,
      sma50Denominator,
      aboveSma50Percent,
      aboveSma200,
      sma200Denominator,
      aboveSma200Percent,
    },
    newHighsLows: {
      newHighs,
      newLows,
      thresholdPct: threshold,
      denominator: hlDenominator,
    },
  };
}

export async function getMarketBreadth(options: MarketBreadthOptions = {}): Promise<MarketBreadthResult> {
  const universe = options.universe ?? "major_us";
  const limit = options.limit ?? 3000;
  const threshold = options.newHighLowThresholdPct ?? 0.5;

  const cacheKey = `breadth:${universe}:${limit}:${threshold}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let exchanges: string[] = [];
  if (universe === "major_us") {
    exchanges = ["NYSE", "NASDAQ", "AMEX"];
  } else if (universe === "both") {
    exchanges = ["NYSE", "NASDAQ"];
  } else {
    exchanges = [universe];
  }

  // Request minimal columns to optimize network and parser
  const columns = ["close", "change", "SMA50", "SMA200", "High.52Week", "Low.52Week", "type", "volume"];
  const filters = [
    { left: "type", operation: "equal", right: "stock" },
    { left: "volume", operation: "greater", right: 10000 },
  ];

  let mergedRows: any[] = [];
  for (const ex of exchanges) {
    try {
      const rows = await scanStocks({
        exchange: ex,
        columns,
        filters,
        limit,
      });
      mergedRows = mergedRows.concat(rows);
    } catch (e) {
      console.error(`Failed to scan breadth for exchange ${ex}:`, e);
    }
  }

  if (mergedRows.length === 0) {
    throw new Error(`Failed to fetch breadth data for universe: ${universe}`);
  }

  const aggregates = aggregateMarketBreadth(mergedRows, {
    universe,
    limit,
    newHighLowThresholdPct: threshold,
  });

  const result: MarketBreadthResult = {
    universe,
    exchanges,
    ...aggregates,
    metadata: {
      source: "tradingview",
      dataDelay: "15min",
      asOf: new Date().toISOString(),
    },
  };

  cache.set(cacheKey, result);
  return result;
}
