import * as http from "node:http";
import { scanStocks } from "../modules/tradingview/scanner.js";
import type { ScanFilter } from "../modules/tradingview/scanner.js";
import { scanCrypto } from "../modules/tradingview-crypto/scanner.js";
import {
  getCompanyNews,
  getEarningsCalendar,
  getAnalystRecommendations,
  getShortInterest,
  getMarketNews,
  getCompanyProfile,
  getPeers,
  getMarketStatus,
  getQuote as getFinnhubQuote,
} from "../modules/finnhub/client.js";
import {
  searchFilings,
  getCompanyFilings,
  getCompanyFacts,
  getInsiderTrades,
  getInstitutionalHoldings,
  getOwnershipFilings,
} from "../modules/sec-edgar/client.js";
import { fetchOptionChain } from "../modules/options/client.js";
import type { OptionContract } from "../modules/options/client.js";
import { getFearAndGreed, getCryptoFearAndGreed } from "../modules/sentiment/client.js";
import { getIndicator, getEconomicCalendar, getIndicatorHistory, searchSeries } from "../modules/fred/client.js";
import { getQuote as getAvQuote, getDailyPrices, getOverview, getEarningsHistory, getDividendHistory } from "../modules/alpha-vantage/client.js";
import { getCoinDetail, getTrending, getGlobal } from "../modules/coingecko/client.js";
import { getPutCallRatio } from "../modules/options-cboe/cboe.js";
import { getLatestRates, getHistoricalRates, getTimeSeries, convertCurrency, getCurrencies } from "../modules/frankfurter/client.js";
import { resolveTicker } from "../shared/resolver.js";

export interface SidecarConfig {
  port: number;
  finnhubApiKey?: string;
  fredApiKey?: string;
  alphaVantageApiKey?: string;
}

const SYMBOL_RE = /^[A-Z][A-Z0-9._-]{0,19}$/i;
const MAX_BODY_BYTES = 1024 * 1024; // 1 MB

const LOCALHOST_ORIGINS = new Set(["http://localhost", "http://127.0.0.1"]);

function getAllowedOrigin(req: http.IncomingMessage): string {
  const origin = req.headers.origin ?? "";
  // Allow localhost on any port
  try {
    const parsed = new URL(origin);
    const base = `${parsed.protocol}//${parsed.hostname}`;
    if (LOCALHOST_ORIGINS.has(base)) return origin;
  } catch { /* invalid origin */ }
  return "http://localhost";
}

function json(res: http.ServerResponse, req: http.IncomingMessage, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": getAllowedOrigin(req),
    "Vary": "Origin",
  });
  res.end(payload);
}

function parseBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error("Request body too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function validateSymbol(symbol: string | null): string {
  if (!symbol) throw new Error("Missing required parameter: symbol");
  if (!SYMBOL_RE.test(symbol)) throw new Error(`Invalid symbol: ${symbol}`);
  return symbol;
}

function parseIntParam(params: URLSearchParams, name: string): number | undefined {
  const raw = params.get(name);
  if (raw === null) return undefined;
  const n = Number(raw);
  if (Number.isNaN(n) || !Number.isFinite(n) || !Number.isInteger(n)) throw new Error(`Invalid ${name} parameter`);
  return n;
}

function parseFloatParam(params: URLSearchParams, name: string, fallback: number): number {
  const raw = params.get(name);
  if (raw === null) return fallback;
  const n = Number(raw);
  if (Number.isNaN(n) || !Number.isFinite(n)) throw new Error(`Invalid ${name} parameter`);
  return n;
}

export function createServer(config: SidecarConfig): http.Server {
  const { finnhubApiKey, fredApiKey, alphaVantageApiKey } = config;

  const server = http.createServer(async (req, res) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": getAllowedOrigin(req),
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Vary": "Origin",
      });
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", `http://localhost:${config.port}`);
    const path = url.pathname;
    const params = url.searchParams;

    try {
      // --- Health ---
      if (path === "/health" && req.method === "GET") {
        json(res, req, 200, { status: "ok" });
        return;
      }

      // --- TradingView stock scan ---
      if (path === "/tradingview/scan" && req.method === "POST") {
        const body = await parseBody(req);
        if (typeof body !== "object" || body === null || Array.isArray(body)) {
          json(res, req, 400, { error: "Invalid request body: expected a JSON object" });
          return;
        }
        const result = await scanStocks(body as Parameters<typeof scanStocks>[0]);
        json(res, req, 200, result);
        return;
      }

      // --- TradingView: Quote ---
      if (path === "/tradingview/quote" && req.method === "GET") {
        const tickersParam = params.get("tickers");
        if (!tickersParam) {
          json(res, req, 400, { error: "Missing required parameter: tickers" });
          return;
        }
        const resolvedTickers = tickersParam.split(",").map(t => resolveTicker(t.trim()).full);
        const rows = await scanStocks({
          tickers: resolvedTickers,
          columns: ["close", "change", "change_abs", "volume", "market_cap_basic", "name", "description",
            "premarket_close", "premarket_change", "premarket_change_abs", "premarket_volume",
            "postmarket_close", "postmarket_change", "postmarket_change_abs", "postmarket_volume"],
        });
        json(res, req, 200, rows);
        return;
      }

      // --- TradingView: Technicals ---
      if (path === "/tradingview/technicals" && req.method === "GET") {
        const tickersParam = params.get("tickers");
        if (!tickersParam) {
          json(res, req, 400, { error: "Missing required parameter: tickers" });
          return;
        }
        const timeframe = params.get("timeframe") ?? undefined;
        const resolvedTickers = tickersParam.split(",").map(t => resolveTicker(t.trim()).full);
        const rows = await scanStocks({
          tickers: resolvedTickers,
          columns: ["Recommend.All", "Recommend.MA", "Recommend.Other", "RSI", "Stoch.K", "Stoch.D",
            "CCI20", "ADX", "ADX+DI", "ADX-DI", "AO", "Mom", "MACD.macd", "MACD.signal",
            "BB.lower", "BB.upper", "EMA20", "EMA50", "EMA200", "SMA20", "SMA50", "SMA200",
            "Pivot.M.Classic.S1", "Pivot.M.Classic.Middle", "Pivot.M.Classic.R1"],
          timeframe,
        });
        json(res, req, 200, rows);
        return;
      }

      // --- TradingView: Compare stocks ---
      if (path === "/tradingview/compare" && req.method === "GET") {
        const tickersParam = params.get("tickers");
        if (!tickersParam) {
          json(res, req, 400, { error: "Missing required parameter: tickers" });
          return;
        }
        const resolvedTickers = tickersParam.split(",").map(t => resolveTicker(t.trim()).full);
        const rows = await scanStocks({
          tickers: resolvedTickers,
          columns: ["name", "description", "close", "change", "market_cap_basic", "price_earnings_ttm",
            "earnings_per_share_basic_ttm", "total_revenue_fq", "dividend_yield_recent", "RSI", "Recommend.All"],
        });
        json(res, req, 200, rows);
        return;
      }

      // --- TradingView: Top gainers ---
      if (path === "/tradingview/top-gainers" && req.method === "GET") {
        const exchange = params.get("exchange") ?? undefined;
        const includeOtc = params.get("include_otc") === "true";
        const limit = parseIntParam(params, "limit") ?? 20;
        const filters: ScanFilter[] = [];
        if (!includeOtc) {
          filters.push({ left: "market_cap_basic", operation: "greater", right: 100_000_000 });
          filters.push({ left: "volume", operation: "greater", right: 100_000 });
        }
        const rows = await scanStocks({
          exchange,
          columns: ["close", "change", "change_abs", "volume", "name", "description", "market_cap_basic"],
          filters, limit,
          sort: { sortBy: "change", sortOrder: "desc" },
        });
        json(res, req, 200, rows);
        return;
      }

      // --- TradingView: Top losers ---
      if (path === "/tradingview/top-losers" && req.method === "GET") {
        const exchange = params.get("exchange") ?? undefined;
        const includeOtc = params.get("include_otc") === "true";
        const limit = parseIntParam(params, "limit") ?? 20;
        const filters: ScanFilter[] = [];
        if (!includeOtc) {
          filters.push({ left: "market_cap_basic", operation: "greater", right: 100_000_000 });
          filters.push({ left: "volume", operation: "greater", right: 100_000 });
        }
        const rows = await scanStocks({
          exchange,
          columns: ["close", "change", "change_abs", "volume", "name", "description", "market_cap_basic"],
          filters, limit,
          sort: { sortBy: "change", sortOrder: "asc" },
        });
        json(res, req, 200, rows);
        return;
      }

      // --- TradingView: Top volume ---
      if (path === "/tradingview/top-volume" && req.method === "GET") {
        const exchange = params.get("exchange") ?? undefined;
        const includeOtc = params.get("include_otc") === "true";
        const limit = parseIntParam(params, "limit") ?? 20;
        const filters: ScanFilter[] = [];
        if (!includeOtc) {
          filters.push({ left: "market_cap_basic", operation: "greater", right: 100_000_000 });
        }
        const rows = await scanStocks({
          exchange,
          columns: ["volume", "close", "change", "name", "description", "market_cap_basic"],
          filters, limit,
        });
        json(res, req, 200, rows);
        return;
      }

      // --- TradingView: Market indices ---
      if (path === "/tradingview/market-indices" && req.method === "GET") {
        const tickers = ["CBOE:VIX", "SP:SPX", "NASDAQ:NDX", "TVC:DJI"];
        const rows = await scanStocks({
          tickers,
          columns: ["close", "change", "change_abs", "high", "low", "open", "name", "description"],
          market: "global",
        });
        json(res, req, 200, rows);
        return;
      }

      // --- TradingView: Sector performance ---
      if (path === "/tradingview/sector-performance" && req.method === "GET") {
        const sectorEtfs = [
          "AMEX:XLK", "AMEX:XLF", "AMEX:XLE", "AMEX:XLV", "AMEX:XLI",
          "AMEX:XLP", "AMEX:XLU", "AMEX:XLY", "AMEX:XLC", "AMEX:XLRE", "AMEX:XLB",
        ];
        const rows = await scanStocks({
          tickers: sectorEtfs,
          columns: ["close", "change", "change_abs", "volume", "name", "description", "Perf.W", "Perf.1M", "Perf.3M", "Perf.YTD"],
        });
        json(res, req, 200, rows);
        return;
      }

      // --- TradingView: Volume breakout ---
      if (path === "/tradingview/volume-breakout" && req.method === "GET") {
        const exchange = params.get("exchange") ?? undefined;
        const limit = parseIntParam(params, "limit") ?? 20;
        const rows = await scanStocks({
          exchange,
          columns: ["volume", "relative_volume_10d_calc", "close", "change", "name", "description", "market_cap_basic", "RSI", "MACD.macd"],
          filters: [
            { left: "relative_volume_10d_calc", operation: "greater", right: 2 },
            { left: "volume", operation: "greater", right: 1_000_000 },
            { left: "market_cap_basic", operation: "greater", right: 100_000_000 },
          ],
          sort: { sortBy: "relative_volume_10d_calc", sortOrder: "desc" },
          limit,
        });
        json(res, req, 200, rows);
        return;
      }

      // --- TradingView crypto scan ---
      if (path === "/tradingview-crypto/scan" && req.method === "POST") {
        const body = await parseBody(req);
        if (typeof body !== "object" || body === null || Array.isArray(body)) {
          json(res, req, 400, { error: "Invalid request body: expected a JSON object" });
          return;
        }
        const result = await scanCrypto(body as Parameters<typeof scanCrypto>[0]);
        json(res, req, 200, result);
        return;
      }

      // --- TradingView Crypto: Quote ---
      if (path === "/tradingview-crypto/quote" && req.method === "GET") {
        const symbolsParam = params.get("symbols");
        if (!symbolsParam) {
          json(res, req, 400, { error: "Missing required parameter: symbols" });
          return;
        }
        const resolvedTickers = symbolsParam.split(",").map(s => {
          const r = resolveTicker(s.trim(), "BINANCE");
          return r.exchange ? `${r.exchange}:${r.ticker}` : `BINANCE:${r.ticker}`;
        });
        const rows = await scanCrypto({
          tickers: resolvedTickers,
          columns: ["close", "change", "change_abs", "volume", "market_cap_calc", "description"],
        });
        json(res, req, 200, rows);
        return;
      }

      // --- TradingView Crypto: Technicals ---
      if (path === "/tradingview-crypto/technicals" && req.method === "GET") {
        const symbolsParam = params.get("symbols");
        if (!symbolsParam) {
          json(res, req, 400, { error: "Missing required parameter: symbols" });
          return;
        }
        const timeframe = params.get("timeframe") ?? undefined;
        const resolvedTickers = symbolsParam.split(",").map(s => {
          const r = resolveTicker(s.trim(), "BINANCE");
          return r.exchange ? `${r.exchange}:${r.ticker}` : `BINANCE:${r.ticker}`;
        });
        const rows = await scanCrypto({
          tickers: resolvedTickers,
          timeframe,
          columns: ["Recommend.All", "Recommend.MA", "Recommend.Other", "RSI", "MACD.macd", "MACD.signal",
            "Stoch.K", "Stoch.D", "EMA20", "EMA50", "EMA200", "SMA20", "SMA50", "SMA200", "BB.lower", "BB.upper", "close"],
        });
        json(res, req, 200, rows);
        return;
      }

      // --- TradingView Crypto: Top gainers ---
      if (path === "/tradingview-crypto/top-gainers" && req.method === "GET") {
        const exchange = params.get("exchange") ?? undefined;
        const limit = parseIntParam(params, "limit") ?? 20;
        const filters: Array<{ left: string; operation: string; right: number | string | number[] | string[] }> = [{ left: "change", operation: "greater", right: 0 }];
        if (exchange) {
          filters.push({ left: "exchange", operation: "equal", right: exchange });
        } else {
          filters.push(
            { left: "exchange", operation: "in_range", right: ["BINANCE", "COINBASE", "KRAKEN", "OKX", "BYBIT", "BITSTAMP"] },
            { left: "volume", operation: "greater", right: 10000 },
          );
        }
        const rows = await scanCrypto({
          filters,
          columns: ["change", "change_abs", "close", "volume", "market_cap_calc", "description"],
          limit: Math.min(limit, 50),
        });
        json(res, req, 200, rows);
        return;
      }

      // --- Finnhub endpoints (gated) ---
      if (path.startsWith("/finnhub/")) {
        if (!finnhubApiKey) {
          json(res, req, 404, { error: "FINNHUB_API_KEY not configured" });
          return;
        }

        if (path === "/finnhub/company-news" && req.method === "GET") {
          const symbol = validateSymbol(params.get("symbol"));
          const from = params.get("from");
          const to = params.get("to");
          if (!from || !to) {
            json(res, req, 400, { error: "Missing required parameters: from, to" });
            return;
          }
          const limit = parseIntParam(params, "limit");
          const result = await getCompanyNews(finnhubApiKey, symbol, from, to, limit);
          json(res, req, 200, result);
          return;
        }

        if (path === "/finnhub/earnings" && req.method === "GET") {
          const from = params.get("from");
          const to = params.get("to");
          if (!from || !to) {
            json(res, req, 400, { error: "Missing required parameters: from, to" });
            return;
          }
          const symbol = params.get("symbol") ?? undefined;
          if (symbol) validateSymbol(symbol);
          const result = await getEarningsCalendar(finnhubApiKey, from, to, symbol);
          json(res, req, 200, result);
          return;
        }

        if (path === "/finnhub/analyst-ratings" && req.method === "GET") {
          const symbol = validateSymbol(params.get("symbol"));
          const result = await getAnalystRecommendations(finnhubApiKey, symbol);
          json(res, req, 200, result);
          return;
        }

        if (path === "/finnhub/short-interest" && req.method === "GET") {
          const symbol = validateSymbol(params.get("symbol"));
          const result = await getShortInterest(finnhubApiKey, symbol);
          json(res, req, 200, result);
          return;
        }

        if (path === "/finnhub/market-news" && req.method === "GET") {
          const category = params.get("category") ?? "general";
          const limit = parseIntParam(params, "limit");
          const result = await getMarketNews(finnhubApiKey, category, limit);
          json(res, req, 200, result);
          return;
        }

        if (path === "/finnhub/company-profile" && req.method === "GET") {
          const symbol = validateSymbol(params.get("symbol"));
          const result = await getCompanyProfile(finnhubApiKey, symbol);
          json(res, req, 200, result);
          return;
        }

        if (path === "/finnhub/peers" && req.method === "GET") {
          const symbol = validateSymbol(params.get("symbol"));
          const result = await getPeers(finnhubApiKey, symbol);
          json(res, req, 200, result);
          return;
        }

        if (path === "/finnhub/market-status" && req.method === "GET") {
          const exchange = params.get("exchange") ?? "US";
          const result = await getMarketStatus(finnhubApiKey, exchange);
          json(res, req, 200, result);
          return;
        }

        if (path === "/finnhub/quote" && req.method === "GET") {
          const symbol = validateSymbol(params.get("symbol"));
          const result = await getFinnhubQuote(finnhubApiKey, symbol);
          json(res, req, 200, result);
          return;
        }
      }

      // --- SEC EDGAR (also /edgar/filings alias) ---
      if ((path === "/sec-edgar/filings" || path === "/edgar/filings") && req.method === "GET") {
        const query = params.get("query");
        if (!query) {
          json(res, req, 400, { error: "Missing required parameter: query" });
          return;
        }
        const dateRange = params.get("dateRange") ?? undefined;
        const forms = params.get("forms") ? params.get("forms")!.split(",") : undefined;
        const tickers = params.get("tickers") ? params.get("tickers")!.split(",") : undefined;
        const limit = parseIntParam(params, "limit");
        const result = await searchFilings({ query, dateRange, forms, tickers, limit });
        json(res, req, 200, result);
        return;
      }

      // --- SEC EDGAR: Company filings ---
      if (path === "/sec-edgar/company-filings" && req.method === "GET") {
        const ticker = validateSymbol(params.get("ticker"));
        const forms = params.get("forms") ? params.get("forms")!.split(",") : undefined;
        const limit = parseIntParam(params, "limit");
        const result = await getCompanyFilings({ ticker, forms, limit });
        json(res, req, 200, result);
        return;
      }

      // --- SEC EDGAR: Company facts (XBRL) ---
      if (path === "/sec-edgar/company-facts" && req.method === "GET") {
        const ticker = validateSymbol(params.get("ticker"));
        const result = await getCompanyFacts(ticker);
        json(res, req, 200, result);
        return;
      }

      // --- SEC EDGAR: Insider trades ---
      if (path === "/sec-edgar/insider-trades" && req.method === "GET") {
        const ticker = validateSymbol(params.get("ticker"));
        const limit = parseIntParam(params, "limit");
        const result = await getInsiderTrades(ticker, limit);
        json(res, req, 200, result);
        return;
      }

      // --- SEC EDGAR: Institutional holdings ---
      if (path === "/sec-edgar/institutional-holdings" && req.method === "GET") {
        const query = params.get("query");
        if (!query) {
          json(res, req, 400, { error: "Missing required parameter: query" });
          return;
        }
        const limit = parseIntParam(params, "limit");
        const result = await getInstitutionalHoldings(query, limit);
        json(res, req, 200, result);
        return;
      }

      // --- SEC EDGAR: Ownership filings (13D/13G) ---
      if (path === "/sec-edgar/ownership-filings" && req.method === "GET") {
        const ticker = validateSymbol(params.get("ticker"));
        const limit = parseIntParam(params, "limit");
        const result = await getOwnershipFilings(ticker, limit);
        json(res, req, 200, result);
        return;
      }

      // --- Options ---
      if (path === "/options/chain" && req.method === "GET") {
        const symbol = validateSymbol(params.get("symbol"));
        const expiration = parseIntParam(params, "expiration");
        const result = await fetchOptionChain(symbol, expiration);
        json(res, req, 200, result);
        return;
      }

      // --- Options: Expirations ---
      if (path === "/options/expirations" && req.method === "GET") {
        const symbol = validateSymbol(params.get("symbol"));
        const chain = await fetchOptionChain(symbol);
        const dates = chain.expirationDates.map(
          (d: number) => new Date(d * 1000).toISOString().split("T")[0],
        );
        json(res, req, 200, { symbol: chain.underlyingSymbol, underlyingPrice: chain.underlyingPrice, expirations: dates });
        return;
      }

      // --- Options: Unusual activity ---
      if (path === "/options/unusual-activity" && req.method === "GET") {
        const symbol = validateSymbol(params.get("symbol"));
        const minRatio = parseFloatParam(params, "volume_oi_ratio", 3.0);
        const minVol = parseFloatParam(params, "min_volume", 100);
        const side = params.get("side") ?? "both";
        const chain = await fetchOptionChain(symbol);
        const allContracts = [
          ...chain.calls.map((c: OptionContract) => ({ ...c, side: "call" as const })),
          ...chain.puts.map((c: OptionContract) => ({ ...c, side: "put" as const })),
        ];
        let unusual = allContracts
          .filter(c => c.volume >= minVol && c.openInterest >= 10)
          .map(c => ({ ...c, volumeOiRatio: Math.round((c.volume / c.openInterest) * 100) / 100 }))
          .filter(c => c.volumeOiRatio >= minRatio);
        if (side !== "both") unusual = unusual.filter(c => c.side === side);
        unusual.sort((a, b) => b.volume - a.volume);
        unusual = unusual.slice(0, 20);
        json(res, req, 200, { symbol: chain.underlyingSymbol, underlyingPrice: chain.underlyingPrice, unusual });
        return;
      }

      // --- Options: Max pain ---
      if (path === "/options/max-pain" && req.method === "GET") {
        const symbol = validateSymbol(params.get("symbol"));
        const expStr = params.get("expiration");
        const expUnix = expStr ? Math.floor(new Date(expStr + "T00:00:00Z").getTime() / 1000) : undefined;
        const chain = await fetchOptionChain(symbol, expUnix);
        const expDate = chain.expirationDates[0]
          ? new Date(chain.expirationDates[0] * 1000).toISOString().split("T")[0]
          : "unknown";
        json(res, req, 200, { symbol: chain.underlyingSymbol, underlyingPrice: chain.underlyingPrice, expiration: expDate, maxPain: chain.maxPain });
        return;
      }

      // --- Options: Implied move ---
      if (path === "/options/implied-move" && req.method === "GET") {
        const symbol = validateSymbol(params.get("symbol"));
        const expStr = params.get("expiration");
        const expUnix = expStr ? Math.floor(new Date(expStr + "T00:00:00Z").getTime() / 1000) : undefined;
        const chain = await fetchOptionChain(symbol, expUnix);
        const price = chain.underlyingPrice;
        const expDate = chain.expirationDates[0]
          ? new Date(chain.expirationDates[0] * 1000).toISOString().split("T")[0]
          : "unknown";
        const atmCall = chain.calls.reduce((best: OptionContract, c: OptionContract) =>
          Math.abs(c.strike - price) < Math.abs(best.strike - price) ? c : best, chain.calls[0]);
        const atmPut = chain.puts.reduce((best: OptionContract, p: OptionContract) =>
          Math.abs(p.strike - price) < Math.abs(best.strike - price) ? p : best, chain.puts[0]);
        if (!atmCall || !atmPut) {
          json(res, req, 200, { symbol: chain.underlyingSymbol, underlyingPrice: price, error: "Insufficient options data" });
          return;
        }
        const callPrice = atmCall.lastPrice || ((atmCall.bid + atmCall.ask) / 2) || 0;
        const putPrice = atmPut.lastPrice || ((atmPut.bid + atmPut.ask) / 2) || 0;
        const straddlePrice = callPrice + putPrice;
        const impliedMovePct = price > 0 ? (straddlePrice / price) * 100 : 0;
        const avgIv = ((atmCall.impliedVolatility || 0) + (atmPut.impliedVolatility || 0)) / 2;
        json(res, req, 200, {
          symbol: chain.underlyingSymbol, underlyingPrice: price, expiration: expDate,
          atmCallStrike: atmCall.strike, atmCallPrice: callPrice,
          atmPutStrike: atmPut.strike, atmPutPrice: putPrice,
          straddlePrice, impliedMove: Math.round(impliedMovePct * 100) / 100,
          impliedMoveAbsolute: Math.round(straddlePrice * 100) / 100,
          impliedVolatility: Math.round(avgIv * 10000) / 100,
          expectedRange: { low: Math.round((price - straddlePrice) * 100) / 100, high: Math.round((price + straddlePrice) * 100) / 100 },
        });
        return;
      }

      // --- Options CBOE: Put/Call ratio ---
      if (path === "/options/put-call-ratio" && req.method === "GET") {
        const type = params.get("type") ?? "total";
        const days = parseIntParam(params, "days") ?? 10;
        const result = await getPutCallRatio(type, days);
        json(res, req, 200, result);
        return;
      }

      // --- Sentiment ---
      if (path === "/sentiment/fear-greed" && req.method === "GET") {
        const result = await getFearAndGreed();
        json(res, req, 200, result);
        return;
      }

      if (path === "/sentiment/crypto-fear-greed" && req.method === "GET") {
        const result = await getCryptoFearAndGreed();
        json(res, req, 200, result);
        return;
      }

      // --- FRED endpoints (gated) ---
      if (path.startsWith("/fred/")) {
        if (!fredApiKey) {
          json(res, req, 404, { error: "FRED_API_KEY not configured" });
          return;
        }

        if (path === "/fred/indicator" && req.method === "GET") {
          const series = params.get("series");
          if (!series) {
            json(res, req, 400, { error: "Missing required parameter: series" });
            return;
          }
          const result = await getIndicator(fredApiKey, series);
          json(res, req, 200, result);
          return;
        }

        if (path === "/fred/calendar" && req.method === "GET") {
          const limit = parseIntParam(params, "limit");
          const result = await getEconomicCalendar(fredApiKey, limit);
          json(res, req, 200, result);
          return;
        }

        if (path === "/fred/indicator-history" && req.method === "GET") {
          const series = params.get("series");
          if (!series) {
            json(res, req, 400, { error: "Missing required parameter: series" });
            return;
          }
          const startDate = params.get("startDate");
          const endDate = params.get("endDate");
          if (!startDate || !endDate) {
            json(res, req, 400, { error: "Missing required parameters: startDate, endDate" });
            return;
          }
          const units = params.get("units") ?? undefined;
          const result = await getIndicatorHistory(fredApiKey, series, startDate, endDate, units);
          json(res, req, 200, result);
          return;
        }

        if (path === "/fred/search" && req.method === "GET") {
          const query = params.get("query");
          if (!query) {
            json(res, req, 400, { error: "Missing required parameter: query" });
            return;
          }
          const limit = parseIntParam(params, "limit");
          const result = await searchSeries(fredApiKey, query, limit);
          json(res, req, 200, result);
          return;
        }
      }

      // --- Alpha Vantage endpoints (gated) ---
      if (path.startsWith("/alpha-vantage/")) {
        if (!alphaVantageApiKey) {
          json(res, req, 404, { error: "ALPHA_VANTAGE_API_KEY not configured" });
          return;
        }

        if (path === "/alpha-vantage/quote" && req.method === "GET") {
          const symbol = validateSymbol(params.get("symbol"));
          const result = await getAvQuote(alphaVantageApiKey, symbol);
          json(res, req, 200, result);
          return;
        }

        if (path === "/alpha-vantage/daily" && req.method === "GET") {
          const symbol = validateSymbol(params.get("symbol"));
          const limit = parseIntParam(params, "limit");
          const result = await getDailyPrices(alphaVantageApiKey, symbol, limit);
          json(res, req, 200, result);
          return;
        }

        if (path === "/alpha-vantage/overview" && req.method === "GET") {
          const symbol = validateSymbol(params.get("symbol"));
          const result = await getOverview(alphaVantageApiKey, symbol);
          json(res, req, 200, result);
          return;
        }

        if (path === "/alpha-vantage/earnings" && req.method === "GET") {
          const symbol = validateSymbol(params.get("symbol"));
          const limit = parseIntParam(params, "limit");
          const result = await getEarningsHistory(alphaVantageApiKey, symbol, limit);
          json(res, req, 200, result);
          return;
        }

        if (path === "/alpha-vantage/dividends" && req.method === "GET") {
          const symbol = validateSymbol(params.get("symbol"));
          const result = await getDividendHistory(alphaVantageApiKey, symbol);
          json(res, req, 200, result);
          return;
        }
      }

      // --- CoinGecko ---
      if (path === "/coingecko/coin" && req.method === "GET") {
        const coinId = params.get("coinId");
        if (!coinId) {
          json(res, req, 400, { error: "Missing required parameter: coinId" });
          return;
        }
        const result = await getCoinDetail(coinId);
        json(res, req, 200, result);
        return;
      }

      if (path === "/coingecko/trending" && req.method === "GET") {
        const result = await getTrending();
        json(res, req, 200, result);
        return;
      }

      if (path === "/coingecko/global" && req.method === "GET") {
        const result = await getGlobal();
        json(res, req, 200, result);
        return;
      }

      // --- Frankfurter (no API key) ---
      if (path === "/frankfurter/latest" && req.method === "GET") {
        const base = params.get("base") ?? "USD";
        const symbols = params.get("symbols") ?? undefined;
        const result = await getLatestRates(base, symbols);
        json(res, req, 200, result);
        return;
      }

      if (path === "/frankfurter/historical" && req.method === "GET") {
        const date = params.get("date");
        if (!date) {
          json(res, req, 400, { error: "Missing required parameter: date" });
          return;
        }
        const base = params.get("base") ?? "USD";
        const symbols = params.get("symbols") ?? undefined;
        const result = await getHistoricalRates(base, date, symbols);
        json(res, req, 200, result);
        return;
      }

      if (path === "/frankfurter/timeseries" && req.method === "GET") {
        const startDate = params.get("start_date");
        const symbols = params.get("symbols");
        if (!startDate || !symbols) {
          json(res, req, 400, { error: "Missing required parameters: start_date, symbols" });
          return;
        }
        const base = params.get("base") ?? "USD";
        const endDate = params.get("end_date") ?? undefined;
        const result = await getTimeSeries(base, symbols, startDate, endDate);
        json(res, req, 200, result);
        return;
      }

      if (path === "/frankfurter/convert" && req.method === "GET") {
        const amount = params.get("amount");
        const from = params.get("from");
        const to = params.get("to");
        if (!amount || !from || !to) {
          json(res, req, 400, { error: "Missing required parameters: amount, from, to" });
          return;
        }
        if (isNaN(Number(amount))) {
          json(res, req, 400, { error: "Invalid parameter: amount must be a number" });
          return;
        }
        const result = await convertCurrency(Number(amount), from, to);
        json(res, req, 200, result);
        return;
      }

      if (path === "/frankfurter/currencies" && req.method === "GET") {
        const result = await getCurrencies();
        json(res, req, 200, result);
        return;
      }

      // --- 404 ---
      json(res, req, 404, { error: "Not found" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const is400 =
        message.startsWith("Missing required parameter") ||
        message.startsWith("Invalid ") ||
        message === "Request body too large";
      json(res, req, is400 ? 400 : 500, { error: message });
    }
  });

  server.listen(config.port);
  return server;
}
