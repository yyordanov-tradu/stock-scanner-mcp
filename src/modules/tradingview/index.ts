import { z } from "zod";
import type { ModuleDefinition, ToolDefinition } from "../../shared/types.js";
import { successResult, errorResult } from "../../shared/types.js";
import { scanStocks } from "./scanner.js";

const scanTool: ToolDefinition = {
  name: "tradingview_scan",
  description: "Scan stocks using TradingView filters. Supports filtering by any technical or fundamental indicator. Returns up to 50 results by default.",
  inputSchema: {
    exchange: z.string().optional().describe("Exchange to scan (e.g. 'NASDAQ', 'NYSE', 'AMEX'). Default: all."),
    filters: z.array(z.object({
      left: z.string().describe("Column name (e.g. 'close', 'RSI', 'volume')"),
      operation: z.string().describe("Comparison: 'greater', 'less', 'in_range', 'equal'"),
      right: z.union([z.number(), z.string()]).describe("Value to compare against"),
    })).optional().describe("Array of filter conditions combined with AND"),
    columns: z.array(z.string()).optional().describe("Columns to return (default: all 62 indicators)"),
    timeframe: z.string().optional().describe("Timeframe: '1m','5m','15m','1h','4h','1d','1W','1M'. Default: '1d'"),
    limit: z.number().optional().describe("Max results to return (default: 50, max: 200)"),
  },
  handler: async (params) => {
    try {
      const rows = await scanStocks({
        exchange: params.exchange as string | undefined,
        filters: params.filters as Array<{ left: string; operation: string; right: number | string }> | undefined,
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
  name: "tradingview_quote",
  description: "Get real-time quotes for specific stock symbols. Returns price, change, volume, and key metrics.",
  inputSchema: {
    symbols: z.array(z.string()).describe("Stock symbols with exchange prefix (e.g. ['NASDAQ:AAPL', 'NYSE:MSFT'])"),
  },
  handler: async (params) => {
    try {
      const rows = await scanStocks({
        tickers: params.symbols as string[],
        columns: ["close", "change", "change_abs", "volume", "market_cap_basic", "price_earnings_ttm", "description"],
      });
      return successResult(JSON.stringify(rows, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

const technicalsTool: ToolDefinition = {
  name: "tradingview_technicals",
  description: "Get technical analysis summary for stock symbols. Includes RSI, MACD, moving averages, and overall recommendation (buy/sell/neutral).",
  inputSchema: {
    symbols: z.array(z.string()).describe("Stock symbols with exchange prefix (e.g. ['NASDAQ:AAPL'])"),
    timeframe: z.string().optional().describe("Timeframe: '1m','5m','15m','1h','4h','1d','1W','1M'. Default: '1d'"),
  },
  handler: async (params) => {
    try {
      const rows = await scanStocks({
        tickers: params.symbols as string[],
        timeframe: params.timeframe as string | undefined,
        columns: [
          "Recommend.All", "Recommend.MA", "Recommend.Other",
          "RSI", "MACD.macd", "MACD.signal",
          "Stoch.K", "Stoch.D", "CCI20", "ADX", "AO", "Mom",
          "EMA20", "EMA50", "EMA200", "SMA20", "SMA50", "SMA200",
          "BB.lower", "BB.upper", "close",
        ],
      });
      return successResult(JSON.stringify(rows, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

const topGainersTool: ToolDefinition = {
  name: "tradingview_top_gainers",
  description: "Get top gaining stocks by percentage change. Filters to common stocks only.",
  inputSchema: {
    exchange: z.string().optional().describe("Exchange: 'NASDAQ', 'NYSE', 'AMEX'. Default: all."),
    limit: z.number().optional().describe("Number of results (default: 20, max: 50)"),
  },
  handler: async (params) => {
    try {
      const rows = await scanStocks({
        exchange: params.exchange as string | undefined,
        filters: [
          { left: "type", operation: "equal", right: "stock" },
          { left: "subtype", operation: "equal", right: "common" },
          { left: "change", operation: "greater", right: 0 },
        ],
        columns: ["close", "change", "change_abs", "volume", "market_cap_basic", "description"],
        limit: Math.min((params.limit as number) ?? 20, 50),
      });
      return successResult(JSON.stringify(rows, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

const topVolumeTool: ToolDefinition = {
  name: "tradingview_top_volume",
  description: "Get stocks with highest trading volume. Filters to common stocks only.",
  inputSchema: {
    exchange: z.string().optional().describe("Exchange: 'NASDAQ', 'NYSE', 'AMEX'. Default: all."),
    limit: z.number().optional().describe("Number of results (default: 20, max: 50)"),
  },
  handler: async (params) => {
    try {
      const rows = await scanStocks({
        exchange: params.exchange as string | undefined,
        filters: [
          { left: "type", operation: "equal", right: "stock" },
          { left: "subtype", operation: "equal", right: "common" },
        ],
        columns: ["close", "change", "volume", "market_cap_basic", "description"],
        limit: Math.min((params.limit as number) ?? 20, 50),
      });
      return successResult(JSON.stringify(rows, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

const volumeBreakoutTool: ToolDefinition = {
  name: "tradingview_volume_breakout",
  description: "Get stocks with unusual trading volume relative to their average volume. Useful for finding momentum and breakouts.",
  inputSchema: {
    exchange: z.string().optional().describe("Exchange: 'NASDAQ', 'NYSE', 'AMEX'. Default: all."),
    minVolume: z.number().optional().describe("Minimum current volume (default: 500k)"),
    limit: z.number().optional().describe("Number of results (default: 20, max: 50)"),
  },
  handler: async (params) => {
    try {
      const rows = await scanStocks({
        exchange: params.exchange as string | undefined,
        filters: [
          { left: "type", operation: "equal", right: "stock" },
          { left: "subtype", operation: "equal", right: "common" },
          { left: "volume", operation: "greater", right: (params.minVolume as number) ?? 500000 },
          { left: "relative_volume_10d_calc", operation: "greater", right: 1.5 },
        ],
        columns: ["close", "change", "volume", "relative_volume_10d_calc", "market_cap_basic", "description"],
        limit: Math.min((params.limit as number) ?? 20, 50),
      });
      return successResult(JSON.stringify(rows, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

export function createTradingviewModule(): ModuleDefinition {
  return {
    name: "tradingview",
    description: "TradingView stock scanner -- real-time quotes, technical analysis, and market screening for US stocks",
    requiredEnvVars: [],
    tools: [scanTool, quoteTool, technicalsTool, topGainersTool, topVolumeTool, volumeBreakoutTool],
  };
}
