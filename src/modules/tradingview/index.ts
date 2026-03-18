import { z } from "zod";
import type { ModuleDefinition } from "../../shared/types.js";
import { successResult } from "../../shared/types.js";
import { scanStocks } from "./scanner.js";
import { resolveTicker } from "../../shared/resolver.js";
import { withMetadata } from "../../shared/utils.js";

export function createTradingviewModule(): ModuleDefinition {
  const metadata = { source: "tradingview", dataDelay: "15min" };

  return {
    name: "tradingview",
    description: "TradingView stock scanner — prices, technicals, and screener filters for US equities",
    requiredEnvVars: [],
    tools: [
      {
        name: "tradingview_scan",
        description: "Scan US stocks with custom filters (price > X, RSI < 30, etc.). Returns up to `limit` rows with the requested columns.",
        inputSchema: z.object({
          exchange: z.string().optional().describe("Exchange filter, e.g. NASDAQ, NYSE, AMEX"),
          filters: z.array(z.object({
            left: z.string(),
            operation: z.enum(["greater", "less", "equal", "in_range", "not_in_range", "crosses", "crosses_above", "crosses_below"]),
            right: z.union([z.number(), z.string(), z.array(z.number())]),
          })).optional().describe("Scanner filters"),
          columns: z.array(z.string()).optional().describe("Columns to return (default: all 66)"),
          timeframe: z.string().optional().describe("Timeframe: 1m, 5m, 15m, 1h, 4h, 1d (default), 1W, 1M"),
          limit: z.number().optional().describe("Max rows (default 50)"),
        }),
        handler: withMetadata(async (input) => {
          const rows = await scanStocks(input);
          return successResult(JSON.stringify(rows, null, 2));
        }, metadata),
      },
      {
        name: "tradingview_quote",
        description: "Get a 15-minute delayed quote for one or more stock tickers (e.g. 'AAPL' or 'NASDAQ:AAPL'). Returns price, change, volume, market cap, and pre-market/after-hours data when available. Data is delayed ~15 minutes during market hours — use finnhub_quote for real-time prices if available. If a ticker returns empty results, retry with the correct exchange prefix (e.g. 'NYSE:CDE', 'AMEX:XYZ').",
        inputSchema: z.object({
          tickers: z.array(z.string()).describe("Stock tickers, e.g. ['AAPL', 'MSFT']"),
        }),
        handler: withMetadata(async (input) => {
          const resolvedTickers = input.tickers.map((t: string) => resolveTicker(t).full);
          const rows = await scanStocks({
            tickers: resolvedTickers,
            columns: [
              "close", "change", "change_abs", "volume", "market_cap_basic", "name", "description",
              "premarket_close", "premarket_change", "premarket_change_abs", "premarket_volume",
              "postmarket_close", "postmarket_change", "postmarket_change_abs", "postmarket_volume",
            ],
          });
          return successResult(JSON.stringify(rows, null, 2));
        }, metadata),
      },
      {
        name: "tradingview_technicals",
        description: "Get technical indicators (RSI, MACD, moving averages, pivot points, etc.) for one or more stock tickers. If a ticker returns empty results, retry with the correct exchange prefix (e.g. 'NYSE:CDE', 'AMEX:XYZ').",
        inputSchema: z.object({
          tickers: z.array(z.string()).describe("Stock tickers, e.g. ['AAPL', 'IBM']"),
          timeframe: z.string().optional().describe("Timeframe (default: 1d)"),
        }),
        handler: withMetadata(async (input) => {
          const technicalCols = [
            "Recommend.All", "Recommend.MA", "Recommend.Other",
            "RSI", "Stoch.K", "Stoch.D", "CCI20", "ADX", "ADX+DI", "ADX-DI",
            "AO", "Mom", "MACD.macd", "MACD.signal", "BB.lower", "BB.upper",
            "EMA20", "EMA50", "EMA200", "SMA20", "SMA50", "SMA200",
            "Pivot.M.Classic.S1", "Pivot.M.Classic.Middle", "Pivot.M.Classic.R1",
          ];
          const resolvedTickers = input.tickers.map((t: string) => resolveTicker(t).full);
          const rows = await scanStocks({
            tickers: resolvedTickers,
            columns: technicalCols,
            timeframe: input.timeframe,
          });
          return successResult(JSON.stringify(rows, null, 2));
        }, metadata),
      },
      {
        name: "tradingview_top_gainers",
        description: "Get today's top gaining stocks by percentage change on a given exchange. Defaults to major US exchanges (NYSE, NASDAQ, AMEX) with market cap > $100M. OTC penny stocks excluded by default.",
        inputSchema: z.object({
          exchange: z.string().optional().describe("Exchange (default: all US)"),
          include_otc: z.boolean().optional().describe("Whether to include OTC penny stocks (default: false)"),
          limit: z.number().optional().describe("Max results (default 20)"),
        }),
        handler: withMetadata(async (input) => {
          const filters = [];
          if (!input.include_otc) {
            filters.push({ left: "market_cap_basic", operation: "greater", right: 100_000_000 });
            filters.push({ left: "volume", operation: "greater", right: 100_000 });
          }
          const rows = await scanStocks({
            exchange: input.exchange,
            columns: ["close", "change", "change_abs", "volume", "name", "description", "market_cap_basic"],
            filters,
            limit: input.limit ?? 20,
          });
          return successResult(JSON.stringify(rows, null, 2));
        }, metadata),
      },
      {
        name: "tradingview_top_losers",
        description: "Get today's top losing stocks by percentage change on a given exchange. Defaults to major US exchanges (NYSE, NASDAQ, AMEX) with market cap > $100M. OTC penny stocks excluded by default.",
        inputSchema: z.object({
          exchange: z.string().optional().describe("Exchange (default: all US)"),
          include_otc: z.boolean().optional().describe("Whether to include OTC penny stocks (default: false)"),
          limit: z.number().optional().describe("Max results (default 20)"),
        }),
        handler: withMetadata(async (input) => {
          const filters = [];
          if (!input.include_otc) {
            filters.push({ left: "market_cap_basic", operation: "greater", right: 100_000_000 });
            filters.push({ left: "volume", operation: "greater", right: 100_000 });
          }
          const rows = await scanStocks({
            exchange: input.exchange,
            columns: ["close", "change", "change_abs", "volume", "name", "description", "market_cap_basic"],
            filters,
            limit: input.limit ?? 20,
            sort: { sortBy: "change", sortOrder: "asc" },
          });
          return successResult(JSON.stringify(rows, null, 2));
        }, metadata),
      },
      {
        name: "tradingview_top_volume",
        description: "Get stocks with the highest trading volume today. Defaults to major US exchanges.",
        inputSchema: z.object({
          exchange: z.string().optional().describe("Exchange (default: all US)"),
          include_otc: z.boolean().optional().describe("Whether to include OTC penny stocks (default: false)"),
          limit: z.number().optional().describe("Max results (default 20)"),
        }),
        handler: withMetadata(async (input) => {
          const filters = [];
          if (!input.include_otc) {
            filters.push({ left: "market_cap_basic", operation: "greater", right: 100_000_000 });
          }
          const rows = await scanStocks({
            exchange: input.exchange,
            columns: ["volume", "close", "change", "name", "description", "market_cap_basic"],
            filters,
            limit: input.limit ?? 20,
          });
          return successResult(JSON.stringify(rows, null, 2));
        }, metadata),
      },
      {
        name: "tradingview_market_indices",
        description: "Get real-time values for major market indices: VIX (volatility), S&P 500, NASDAQ Composite, and Dow Jones. Essential for gauging broad market conditions, risk sentiment, and options pricing context.",
        inputSchema: z.object({}),
        handler: withMetadata(async () => {
          const tickers = ["CBOE:VIX", "SP:SPX", "NASDAQ:NDX", "TVC:DJI"];
          const columns = [
            "close", "change", "change_abs", "high", "low", "open",
            "name", "description",
          ];
          const rows = await scanStocks({ tickers, columns, market: "global" });
          return successResult(JSON.stringify(rows, null, 2));
        }, metadata),
      },
      {
        name: "tradingview_sector_performance",
        description: "Get performance of S&P 500 sector ETFs (XLK, XLF, XLE, XLV, XLI, XLP, XLU, XLY, XLC, XLRE, XLB). Shows which sectors are leading or lagging today. Essential for sector rotation analysis.",
        inputSchema: z.object({}),
        handler: withMetadata(async () => {
          const sectorEtfs = [
            "AMEX:XLK", "AMEX:XLF", "AMEX:XLE", "AMEX:XLV", "AMEX:XLI",
            "AMEX:XLP", "AMEX:XLU", "AMEX:XLY", "AMEX:XLC", "AMEX:XLRE", "AMEX:XLB",
          ];
          const rows = await scanStocks({
            tickers: sectorEtfs,
            columns: [
              "close", "change", "change_abs", "volume", "name", "description",
              "Perf.W", "Perf.1M", "Perf.3M", "Perf.YTD",
            ],
          });
          return successResult(JSON.stringify(rows, null, 2));
        }, metadata),
      },
      {
        name: "tradingview_volume_breakout",
        description: "Find stocks with unusual volume (current volume significantly above average). Defaults to major exchanges.",
        inputSchema: z.object({
          exchange: z.string().optional().describe("Exchange filter"),
          limit: z.number().optional().describe("Max results (default 20)"),
        }),
        handler: withMetadata(async (input) => {
          const rows = await scanStocks({
            exchange: input.exchange,
            columns: ["volume", "relative_volume_10d_calc", "close", "change", "name", "description", "market_cap_basic", "RSI", "MACD.macd"],
            filters: [
              { left: "relative_volume_10d_calc", operation: "greater", right: 2 },
              { left: "volume", operation: "greater", right: 1_000_000 },
              { left: "market_cap_basic", operation: "greater", right: 100_000_000 },
            ],
            sort: { sortBy: "relative_volume_10d_calc", sortOrder: "desc" },
            limit: input.limit ?? 20,
          });
          return successResult(JSON.stringify(rows, null, 2));
        }, metadata),
      },
    ],
  };
}
