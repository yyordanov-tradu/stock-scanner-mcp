import { z } from "zod";
import type { ModuleDefinition } from "../../shared/types.js";
import { successResult } from "../../shared/types.js";
import { scanCrypto } from "./scanner.js";
import { resolveTicker } from "../../shared/resolver.js";
import { withMetadata } from "../../shared/utils.js";

const MAJOR_EXCHANGES = ["BINANCE", "COINBASE", "KRAKEN", "OKX", "BYBIT", "BITSTAMP"];

const MAJOR_ONLY_FILTERS = [
  { left: "exchange", operation: "in_range", right: MAJOR_EXCHANGES },
  { left: "volume", operation: "greater", right: 10000 }, // $10k min volume to filter junk
];

export function createTradingviewCryptoModule(): ModuleDefinition {
  const metadata = { source: "tradingview", dataDelay: "15min" };

  return {
    name: "tradingview-crypto",
    description:
      "TradingView crypto scanner -- real-time quotes, technical analysis, and screening for cryptocurrency pairs",
    requiredEnvVars: [],
    tools: [
      {
        name: "crypto_scan",
        description:
          "Scan cryptocurrency pairs using TradingView filters. Returns price, volume, and technical indicators.",
        inputSchema: z.object({
          filters: z
            .array(
              z.object({
                left: z.string().describe("Column name (e.g. 'close', 'RSI', 'volume')"),
                operation: z.string().describe("Comparison: 'greater', 'less', 'in_range', 'equal'"),
                right: z.union([z.number(), z.string(), z.array(z.number()), z.array(z.string())]).describe("Value to compare against"),
              }),
            )
            .optional()
            .describe("Filter conditions combined with AND"),
          major_only: z.boolean().optional().describe("Only include major exchanges (default: true)"),
          columns: z.array(z.string()).optional().describe("Columns to return (default: all 24)"),
          timeframe: z
            .string()
            .optional()
            .describe("Timeframe: '1m','5m','15m','1h','4h','1d','1W','1M'. Default: '1d'"),
          limit: z.number().optional().describe("Max results (default: 50, max: 200)"),
        }),
        handler: withMetadata(async (params) => {
          const majorOnly = (params.major_only as boolean) ?? true;
          let filters = (params.filters as any[]) || [];
          if (majorOnly) {
            filters = [...MAJOR_ONLY_FILTERS, ...filters];
          }

          const rows = await scanCrypto({
            filters,
            columns: params.columns as string[] | undefined,
            timeframe: params.timeframe as string | undefined,
            limit: Math.min((params.limit as number) ?? 50, 200),
          });
          return successResult(JSON.stringify(rows, null, 2));
        }, metadata),
      },
      {
        name: "crypto_quote",
        description:
          "Get real-time quotes for specific crypto pairs. Supports 'BTCUSDT' (defaults to BINANCE) or 'BINANCE:BTCUSDT'.",
        inputSchema: z.object({
          symbols: z
            .array(z.string())
            .describe("Crypto pair symbols (e.g. ['BTCUSDT', 'ETHUSDT'])"),
        }),
        handler: withMetadata(async (params) => {
          const resolvedTickers = (params.symbols as string[]).map(s => {
            const res = resolveTicker(s, "BINANCE");
            return res.exchange ? `${res.exchange}:${res.ticker}` : `BINANCE:${res.ticker}`;
          });
          const rows = await scanCrypto({
            tickers: resolvedTickers,
            columns: [
              "close",
              "change",
              "change_abs",
              "volume",
              "market_cap_calc",
              "description",
            ],
          });
          return successResult(JSON.stringify(rows, null, 2));
        }, metadata),
      },
      {
        name: "crypto_technicals",
        description:
          "Get technical analysis for crypto pairs. Supports 'BTCUSDT' or 'BINANCE:BTCUSDT'.",
        inputSchema: z.object({
          symbols: z.array(z.string()).describe("Crypto symbols (e.g. ['BTCUSDT'])"),
          timeframe: z.string().optional().describe("Timeframe. Default: '1d'"),
        }),
        handler: withMetadata(async (params) => {
          const resolvedTickers = (params.symbols as string[]).map(s => {
            const res = resolveTicker(s, "BINANCE");
            return res.exchange ? `${res.exchange}:${res.ticker}` : `BINANCE:${res.ticker}`;
          });
          const rows = await scanCrypto({
            tickers: resolvedTickers,
            timeframe: params.timeframe as string | undefined,
            columns: [
              "Recommend.All",
              "Recommend.MA",
              "Recommend.Other",
              "RSI",
              "MACD.macd",
              "MACD.signal",
              "Stoch.K",
              "Stoch.D",
              "EMA20",
              "EMA50",
              "EMA200",
              "SMA20",
              "SMA50",
              "SMA200",
              "BB.lower",
              "BB.upper",
              "close",
            ],
          });
          return successResult(JSON.stringify(rows, null, 2));
        }, metadata),
      },
      {
        name: "crypto_top_gainers",
        description: "Get top gaining cryptocurrency pairs by percentage change. Defaults to major exchanges and volume > $10k.",
        inputSchema: z.object({
          exchange: z.string().optional().describe("Specific exchange (e.g. BINANCE)"),
          limit: z.number().optional().describe("Number of results (default: 20, max: 50)"),
        }),
        handler: withMetadata(async (params) => {
          const filters: any[] = [{ left: "change", operation: "greater", right: 0 }];
          if (params.exchange) {
            filters.push({ left: "exchange", operation: "equal", right: params.exchange });
          } else {
            filters.push(...MAJOR_ONLY_FILTERS);
          }

          const rows = await scanCrypto({
            filters,
            columns: [
              "close",
              "change",
              "change_abs",
              "volume",
              "market_cap_calc",
              "description",
            ],
            limit: Math.min((params.limit as number) ?? 20, 50),
          });
          return successResult(JSON.stringify(rows, null, 2));
        }, metadata),
      },
    ],
  };
}
