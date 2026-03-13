import { z } from "zod";
import type { ModuleDefinition, ToolDefinition } from "../../shared/types.js";
import { successResult, errorResult } from "../../shared/types.js";
import { scanCrypto } from "./scanner.js";

const scanTool: ToolDefinition = {
  name: "crypto_scan",
  description:
    "Scan cryptocurrency pairs using TradingView filters. Returns price, volume, and technical indicators.",
  inputSchema: {
    filters: z
      .array(
        z.object({
          left: z.string().describe("Column name (e.g. 'close', 'RSI', 'volume')"),
          operation: z.string().describe("Comparison: 'greater', 'less', 'in_range', 'equal'"),
          right: z.union([z.number(), z.string(), z.array(z.number())]).describe("Value to compare against"),
        }),
      )
      .optional()
      .describe("Filter conditions combined with AND"),
    columns: z.array(z.string()).optional().describe("Columns to return (default: all 24)"),
    timeframe: z
      .string()
      .optional()
      .describe("Timeframe: '1m','5m','15m','1h','4h','1d','1W','1M'. Default: '1d'"),
    limit: z.number().optional().describe("Max results (default: 50, max: 200)"),
  },
  handler: async (params) => {
    try {
      const rows = await scanCrypto({
        filters: params.filters as
          | Array<{ left: string; operation: string; right: number | string | number[] }>
          | undefined,
        columns: params.columns as string[] | undefined,
        timeframe: params.timeframe as string | undefined,
        limit: Math.min((params.limit as number) ?? 50, 200),
      });
      return successResult(JSON.stringify(rows, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

const quoteTool: ToolDefinition = {
  name: "crypto_quote",
  description:
    "Get real-time quotes for specific crypto pairs. Use exchange:pair format (e.g. BINANCE:BTCUSDT).",
  inputSchema: {
    symbols: z
      .array(z.string())
      .describe("Crypto pair symbols (e.g. ['BINANCE:BTCUSDT', 'BINANCE:ETHUSDT'])"),
  },
  handler: async (params) => {
    try {
      const rows = await scanCrypto({
        tickers: params.symbols as string[],
        columns: [
          "close",
          "change",
          "change_abs",
          "volume",
          "24h_vol",
          "market_cap_calc",
          "description",
        ],
      });
      return successResult(JSON.stringify(rows, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

const technicalsTool: ToolDefinition = {
  name: "crypto_technicals",
  description:
    "Get technical analysis for crypto pairs. Includes RSI, MACD, moving averages, and recommendation.",
  inputSchema: {
    symbols: z.array(z.string()).describe("Crypto symbols (e.g. ['BINANCE:BTCUSDT'])"),
    timeframe: z.string().optional().describe("Timeframe. Default: '1d'"),
  },
  handler: async (params) => {
    try {
      const rows = await scanCrypto({
        tickers: params.symbols as string[],
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
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

const topGainersTool: ToolDefinition = {
  name: "crypto_top_gainers",
  description: "Get top gaining cryptocurrency pairs by percentage change.",
  inputSchema: {
    limit: z.number().optional().describe("Number of results (default: 20, max: 50)"),
  },
  handler: async (params) => {
    try {
      const rows = await scanCrypto({
        filters: [{ left: "change", operation: "greater", right: 0 }],
        columns: [
          "close",
          "change",
          "change_abs",
          "volume",
          "24h_vol",
          "market_cap_calc",
          "description",
        ],
        limit: Math.min((params.limit as number) ?? 20, 50),
      });
      return successResult(JSON.stringify(rows, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

export function createTradingviewCryptoModule(): ModuleDefinition {
  return {
    name: "tradingview-crypto",
    description:
      "TradingView crypto scanner -- real-time quotes, technical analysis, and screening for cryptocurrency pairs",
    requiredEnvVars: [],
    tools: [scanTool, quoteTool, technicalsTool, topGainersTool],
  };
}
