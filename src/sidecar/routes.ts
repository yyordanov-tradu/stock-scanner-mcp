import { z } from "zod";

export interface SidecarRoute {
  method: "GET" | "POST";
  path: string;
  tool: string;
  transformParams?: (params: URLSearchParams) => Record<string, any>;
  transformResponse?: (data: any) => any;
}

export const SIDECAR_ROUTES: SidecarRoute[] = [
  // TradingView
  { method: "POST", path: "/tradingview/scan", tool: "tradingview_scan" },
  { 
    method: "GET", 
    path: "/tradingview/quote", 
    tool: "tradingview_quote",
    transformParams: (p) => ({ tickers: p.get("tickers")?.split(",").map(s => s.trim()).filter(Boolean) })
  },
  { 
    method: "GET", 
    path: "/tradingview/technicals", 
    tool: "tradingview_technicals",
    transformParams: (p) => ({ 
      tickers: p.get("tickers")?.split(",").map(s => s.trim()).filter(Boolean),
      timeframe: p.get("timeframe") || undefined
    })
  },
  { 
    method: "GET", 
    path: "/tradingview/compare", 
    tool: "tradingview_compare_stocks",
    transformParams: (p) => ({ tickers: p.get("tickers")?.split(",").map(s => s.trim()).filter(Boolean) })
  },
  { method: "GET", path: "/tradingview/top-gainers", tool: "tradingview_top_gainers" },
  { method: "GET", path: "/tradingview/top-losers", tool: "tradingview_top_losers" },
  { method: "GET", path: "/tradingview/top-volume", tool: "tradingview_top_volume" },
  { method: "GET", path: "/tradingview/market-indices", tool: "tradingview_market_indices" },
  { method: "GET", path: "/tradingview/sector-performance", tool: "tradingview_sector_performance" },
  { method: "GET", path: "/tradingview/volume-breakout", tool: "tradingview_volume_breakout" },

  // TradingView Crypto
  { method: "POST", path: "/tradingview-crypto/scan", tool: "crypto_scan" },
  { 
    method: "GET", 
    path: "/tradingview-crypto/quote", 
    tool: "crypto_quote",
    transformParams: (p) => ({ symbols: p.get("symbols")?.split(",").map(s => s.trim()).filter(Boolean) })
  },
  { 
    method: "GET", 
    path: "/tradingview-crypto/technicals", 
    tool: "crypto_technicals",
    transformParams: (p) => ({ 
      symbols: p.get("symbols")?.split(",").map(s => s.trim()).filter(Boolean),
      timeframe: p.get("timeframe") || undefined
    })
  },
  { method: "GET", path: "/tradingview-crypto/top-gainers", tool: "crypto_top_gainers" },

  // Finnhub
  { method: "GET", path: "/finnhub/company-news", tool: "finnhub_company_news" },
  { method: "GET", path: "/finnhub/earnings", tool: "finnhub_earnings_calendar" },
  { method: "GET", path: "/finnhub/analyst-ratings", tool: "finnhub_analyst_ratings" },
  { method: "GET", path: "/finnhub/short-interest", tool: "finnhub_short_interest" },
  { method: "GET", path: "/finnhub/market-news", tool: "finnhub_market_news" },
  { method: "GET", path: "/finnhub/company-profile", tool: "finnhub_company_profile" },
  { 
    method: "GET", 
    path: "/finnhub/peers", 
    tool: "finnhub_peers",
    transformResponse: (data) => data.peers 
  },
  { method: "GET", path: "/finnhub/market-status", tool: "finnhub_market_status" },
  { 
    method: "GET", 
    path: "/finnhub/quote", 
    tool: "finnhub_quote",
    transformResponse: (data) => ({
      c: data.price,
      d: data.change,
      dp: data.changePercent,
      h: data.dayHigh,
      l: data.dayLow,
      o: data.open,
      pc: data.previousClose,
      t: data.timestamp,
    })
  },

  // SEC EDGAR
  { method: "GET", path: "/sec-edgar/filings", tool: "edgar_search" },
  { method: "GET", path: "/edgar/filings", tool: "edgar_search" },
  { method: "GET", path: "/sec-edgar/company-filings", tool: "edgar_company_filings" },
  { method: "GET", path: "/sec-edgar/company-facts", tool: "edgar_company_facts" },
  { method: "GET", path: "/sec-edgar/insider-trades", tool: "edgar_insider_trades" },
  { method: "GET", path: "/sec-edgar/institutional-holdings", tool: "edgar_institutional_holdings" },
  { method: "GET", path: "/sec-edgar/ownership-filings", tool: "edgar_ownership_filings" },

  // Options
  { method: "GET", path: "/options/chain", tool: "options_chain" },
  { method: "GET", path: "/options/expirations", tool: "options_expirations" },
  { method: "GET", path: "/options/unusual-activity", tool: "options_unusual_activity" },
  { method: "GET", path: "/options/max-pain", tool: "options_max_pain" },
  { method: "GET", path: "/options/implied-move", tool: "options_implied_move" },
  { method: "GET", path: "/options/put-call-ratio", tool: "options_put_call_ratio" },

  // Sentiment
  { method: "GET", path: "/sentiment/fear-greed", tool: "sentiment_fear_greed" },
  { method: "GET", path: "/sentiment/crypto-fear-greed", tool: "sentiment_crypto_fear_greed" },

  // FRED
  { 
    method: "GET", 
    path: "/fred/indicator", 
    tool: "fred_indicator",
    transformParams: (p) => ({ series_id: p.get("series") || p.get("series_id") })
  },
  { method: "GET", path: "/fred/calendar", tool: "fred_economic_calendar" },
  { 
    method: "GET", 
    path: "/fred/indicator-history", 
    tool: "fred_indicator_history",
    transformParams: (p) => ({ 
      series_id: p.get("series") || p.get("series_id"),
      start_date: p.get("startDate") || p.get("start_date"),
      end_date: p.get("endDate") || p.get("end_date"),
      units: p.get("units") || undefined
    })
  },
  { method: "GET", path: "/fred/search", tool: "fred_search" },

  // Alpha Vantage
  { method: "GET", path: "/alpha-vantage/quote", tool: "alphavantage_quote" },
  { method: "GET", path: "/alpha-vantage/daily", tool: "alphavantage_daily" },
  { 
    method: "GET", 
    path: "/alpha-vantage/overview", 
    tool: "alphavantage_overview",
    transformParams: (p) => {
      const symbols = p.get("symbols") || p.get("symbol");
      return { 
        symbols: symbols ? symbols.split(",").map(s => s.trim()).filter(Boolean) : undefined 
      };
    }
  },
  { method: "GET", path: "/alpha-vantage/earnings", tool: "alphavantage_earnings_history" },
  { method: "GET", path: "/alpha-vantage/dividends", tool: "alphavantage_dividend_history" },

  // Reddit
  { method: "GET", path: "/reddit/trending", tool: "reddit_trending" },
  { method: "GET", path: "/reddit/mentions", tool: "reddit_mentions" },
  { method: "GET", path: "/reddit/sentiment", tool: "reddit_sentiment" },

  // Workspace
  { method: "GET", path: "/workspace/profile", tool: "workspace_get_profile" },
  { method: "POST", path: "/workspace/profile", tool: "workspace_update_profile" },
  { method: "GET", path: "/workspace/watchlists", tool: "workspace_list_watchlists" },
  { method: "POST", path: "/workspace/watchlists", tool: "workspace_create_watchlist" },
  { method: "POST", path: "/workspace/watchlists/update", tool: "workspace_update_watchlist" },
  { method: "GET", path: "/workspace/thesis", tool: "workspace_get_thesis" },
  { method: "POST", path: "/workspace/thesis", tool: "workspace_save_thesis" },

  // CoinGecko
  { method: "GET", path: "/coingecko/coin", tool: "coingecko_coin" },
  { method: "GET", path: "/coingecko/trending", tool: "coingecko_trending" },
  { method: "GET", path: "/coingecko/global", tool: "coingecko_global" },

  // Frankfurter
  { method: "GET", path: "/frankfurter/latest", tool: "frankfurter_latest" },
  { method: "GET", path: "/frankfurter/historical", tool: "frankfurter_historical" },
  { method: "GET", path: "/frankfurter/timeseries", tool: "frankfurter_timeseries" },
  { method: "GET", path: "/frankfurter/convert", tool: "frankfurter_convert" },
  { method: "GET", path: "/frankfurter/currencies", tool: "frankfurter_currencies" },
];

/**
 * Helper to cast string-based query parameters to their expected types based on a Zod schema.
 */
export function castQueryParams(params: URLSearchParams, schema: z.ZodObject<any>) {
  const result: Record<string, any> = {};
  const shape = (schema as any).shape || {};

  for (const [key, zodType] of Object.entries(shape)) {
    const val = params.get(key);
    if (val === null) continue;

    const getTypeName = (z: any): string => {
      const d = z?._def;
      if (!d) return "unknown";
      const typeName = d.type || d.typeName;
      if (typeName === "optional" || typeName === "ZodOptional" || 
          typeName === "nullable" || typeName === "ZodNullable" || 
          typeName === "default" || typeName === "ZodDefault") {
        return getTypeName(d.innerType || d.schema);
      }
      return typeName || "unknown";
    };

    const type = getTypeName(zodType);

    if (type === "number" || type === "ZodNumber") {
      result[key] = Number(val);
    } else if (type === "boolean" || type === "ZodBoolean") {
      result[key] = val === "true";
    } else if (type === "array" || type === "ZodArray") {
      result[key] = val.split(",").map(v => v.trim()).filter(Boolean);
    } else {
      result[key] = val;
    }
  }

  return result;
}
