import { Config } from "../../config.js";
import { resolveTicker } from "../../shared/resolver.js";
import { classifyError } from "../../shared/errors.js";
import { getQuote as getFinnhubQuote, getCompanyProfile as getFinnhubProfile } from "../finnhub/client.js";
import { getQuote as getAvQuote, getOverview as getAvOverview } from "../alpha-vantage/client.js";
import { scanStocks } from "../tradingview/scanner.js";
import { scanCrypto } from "../tradingview-crypto/scanner.js";

export interface UnifiedQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  dayHigh: number;
  dayLow: number;
  open: number;
  previousClose: number;
  resolvedProvider: string;
  isRealTime: boolean;
  dataDelay: string;
}

export interface UnifiedProfile {
  symbol: string;
  name: string;
  exchange: string;
  industry: string;
  marketCap: number;
  sharesOutstanding: number;
  website: string;
  description: string;
  resolvedProvider: string;
}

export async function routeGetQuote(symbol: string, config: Config): Promise<UnifiedQuote> {
  const resolved = resolveTicker(symbol);

  if (resolved.isCrypto) {
    // 1. Try TradingView Crypto (keyless)
    try {
      const rows = await scanCrypto({
        tickers: [resolved.full],
        columns: ["close", "change", "change_abs", "volume", "high", "low", "open"]
      });
      
      const row = rows[0];
      if (!row) {
        throw new Error(`Crypto symbol ${symbol} not found in TradingView.`);
      }

      return {
        symbol: resolved.full,
        price: Number(row.data.close || 0),
        change: Number(row.data.change_abs || 0),
        changePercent: Number(row.data.change || 0),
        volume: Number(row.data.volume || 0),
        dayHigh: Number(row.data.high || 0),
        dayLow: Number(row.data.low || 0),
        open: Number(row.data.open || 0),
        previousClose: Number(row.data.close || 0) - Number(row.data.change_abs || 0),
        resolvedProvider: "tradingview-crypto",
        isRealTime: true,
        dataDelay: "real-time",
      };
    } catch (e) {
      // CoinGecko mapping deferred to v2. Throw terminal error.
      throw e;
    }
  }

  // 1. Try Finnhub if key is configured
  if (config.env.FINNHUB_API_KEY) {
    try {
      const q = await getFinnhubQuote(config.env.FINNHUB_API_KEY, resolved.ticker);
      
      // Sentinel check: Finnhub returns {c:0, d:0, h:0, l:0, o:0, pc:0, t:0} for invalid symbols
      if (q.c === 0 && q.pc === 0 && q.t === 0) {
        throw new Error(`Finnhub returned empty quote for ${resolved.ticker} (symbol not found)`);
      }
      
      return {
        symbol: resolved.full,
        price: q.c,
        change: q.d,
        changePercent: q.dp,
        volume: 0, // Finnhub quote doesn't return volume directly
        dayHigh: q.h,
        dayLow: q.l,
        open: q.o,
        previousClose: q.pc,
        resolvedProvider: "finnhub",
        isRealTime: true,
        dataDelay: "real-time",
      };
    } catch (e) {
      const classified = classifyError(e);
      if (!classified.retryable) {
        throw e; // Propagate NOT_FOUND, FORBIDDEN immediately
      }
      console.warn(`Finnhub quote routing failed (${classified.code}), attempting fallback...`);
    }
  }

  // 2. Try Alpha Vantage if key is configured
  if (config.env.ALPHA_VANTAGE_API_KEY) {
    try {
      const q = await getAvQuote(config.env.ALPHA_VANTAGE_API_KEY, resolved.ticker);
      return {
        symbol: resolved.full,
        price: q.price,
        change: q.change,
        changePercent: parseFloat(q.changePercent) || 0,
        volume: q.volume,
        dayHigh: q.high,
        dayLow: q.low,
        open: q.open,
        previousClose: q.previousClose,
        resolvedProvider: "alpha-vantage",
        isRealTime: true,
        dataDelay: "real-time",
      };
    } catch (e) {
      const classified = classifyError(e);
      if (!classified.retryable) {
        throw e;
      }
      console.warn(`Alpha Vantage quote routing failed (${classified.code}), attempting fallback...`);
    }
  }

  // 3. Fall back to TradingView (keyless, 15-minute delay)
  const rows = await scanStocks({
    tickers: [resolved.full],
    columns: ["close", "change", "change_abs", "volume", "high", "low", "open"] 
  });
  
  const row = rows[0];
  if (!row) {
    throw new Error(`Symbol ${symbol} not found across all available providers.`);
  }

  return {
    symbol: resolved.full,
    price: Number(row.data.close || 0),
    change: Number(row.data.change_abs || 0),
    changePercent: Number(row.data.change || 0),
    volume: Number(row.data.volume || 0),
    dayHigh: Number(row.data.high || 0),
    dayLow: Number(row.data.low || 0),
    open: Number(row.data.open || 0),
    previousClose: Number(row.data.close || 0) - Number(row.data.change_abs || 0),
    resolvedProvider: "tradingview",
    isRealTime: false,
    dataDelay: "15min",
  };
}

export async function routeGetProfile(symbol: string, config: Config): Promise<UnifiedProfile> {
  const resolved = resolveTicker(symbol);

  // 1. Try Finnhub if key is configured
  if (config.env.FINNHUB_API_KEY) {
    try {
      const p = await getFinnhubProfile(config.env.FINNHUB_API_KEY, resolved.ticker);
      
      // Finnhub returns empty object {} for not found profiles
      if (!p || Object.keys(p).length === 0 || !p.name) {
        throw new Error(`Finnhub returned empty profile for ${resolved.ticker} (not found)`);
      }

      return {
        symbol: resolved.full,
        name: p.name,
        exchange: p.exchange,
        industry: p.finnhubIndustry,
        marketCap: (p.marketCapitalization || 0) * 1000000, // Finnhub returns in millions
        sharesOutstanding: (p.shareOutstanding || 0) * 1000000, // Finnhub returns in millions
        website: p.weburl || "",
        description: "", // Finnhub basic profile doesn't include description
        resolvedProvider: "finnhub",
      };
    } catch (e) {
      const classified = classifyError(e);
      if (!classified.retryable && classified.code !== "INTERNAL_ERROR") {
        throw e;
      }
      console.warn(`Finnhub profile routing failed (${classified.code}), attempting fallback...`);
    }
  }

  // 2. Try Alpha Vantage if key is configured
  if (config.env.ALPHA_VANTAGE_API_KEY) {
    try {
      const p = await getAvOverview(config.env.ALPHA_VANTAGE_API_KEY, resolved.ticker);
      return {
        symbol: resolved.full,
        name: p.name,
        exchange: p.exchange,
        industry: p.industry,
        marketCap: p.marketCap,
        sharesOutstanding: 0,
        website: "", // AV overview doesn't reliably include website URL
        description: p.description,
        resolvedProvider: "alpha-vantage",
      };
    } catch (e) {
      const classified = classifyError(e);
      if (!classified.retryable && classified.code !== "INTERNAL_ERROR") {
        throw e;
      }
      console.warn(`Alpha Vantage profile routing failed (${classified.code}), attempting fallback...`);
    }
  }

  // 3. Fall back to TradingView
  const rows = await scanStocks({
    tickers: [resolved.full],
    columns: ["name", "description", "exchange", "sector", "market_cap_basic", "type"]
  });
  
  const row = rows[0];
  if (!row) {
    throw new Error(`Profile for ${symbol} not found across all available providers.`);
  }

  return {
    symbol: resolved.full,
    name: String(row.data.description || row.data.name || resolved.ticker),
    exchange: String(row.data.exchange || resolved.exchange || ""),
    industry: String(row.data.sector || ""),
    marketCap: Number(row.data.market_cap_basic || 0),
    sharesOutstanding: 0, // TV doesn't return shares outstanding easily in basic columns
    website: "",
    description: "",
    resolvedProvider: "tradingview",
  };
}

export async function routeGetTechnicals(symbol: string): Promise<Record<string, any>> {
  const resolved = resolveTicker(symbol);
  
  const columns = [
    "RSI", "RSI[1]",
    "MACD.macd", "MACD.signal",
    "Stoch.K", "Stoch.D",
    "SMA50", "SMA200", "EMA20",
    "BB.upper", "BB.lower",
    "ADX"
  ];

  let rows;
  if (resolved.isCrypto) {
    rows = await scanCrypto({ tickers: [resolved.full], columns });
  } else {
    rows = await scanStocks({ tickers: [resolved.full], columns });
  }
  
  const row = rows[0];
  if (!row) {
    throw new Error(`Technicals for ${symbol} not found in TradingView.`);
  }

  return {
    symbol: resolved.full,
    technicals: row.data,
    resolvedProvider: "tradingview",
    dataDelay: "15min",
  };
}
