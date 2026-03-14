import { z } from "zod";
import type { ModuleDefinition, ToolDefinition, ToolResult } from "../../shared/types.js";
import { errorResult, successResult } from "../../shared/types.js";
import { scanStocks } from "./scanner.js";
import { STOCK_COLUMNS } from "./columns.js";

export function createTradingviewModule(): ModuleDefinition {
  return {
    name: "tradingview",
    description: "TradingView stock scanner — prices, technicals, and screener filters for US equities",
    requiredEnvVars: [],
    tools: [
      {
        name: "tradingview_scan",
        description: "Scan US stocks with custom filters (price > X, RSI < 30, etc.). Returns up to `limit` rows with the requested columns.",
        inputSchema: {
          exchange: z.string().optional().describe("Exchange filter, e.g. NASDAQ, NYSE, AMEX"),
          filters: z.array(z.object({
            left: z.string(),
            operation: z.enum(["greater", "less", "equal", "in_range", "not_in_range", "crosses", "crosses_above", "crosses_below"]),
            right: z.union([z.number(), z.string(), z.array(z.number())]),
          })).optional().describe("Scanner filters"),
          columns: z.array(z.string()).optional().describe("Columns to return (default: all 66)"),
          timeframe: z.string().optional().describe("Timeframe: 1m, 5m, 15m, 1h, 4h, 1d (default), 1W, 1M"),
          limit: z.number().optional().describe("Max rows (default 50)"),
        },
        handler: async (input): Promise<ToolResult> => {
          try {
            const rows = await scanStocks(input as Record<string, unknown> & Parameters<typeof scanStocks>[0]);
            return successResult(JSON.stringify(rows, null, 2));
          } catch (e) {
            return errorResult(`Scan failed: ${(e as Error).message}`);
          }
        },
      },
      {
        name: "tradingview_quote",
        description: "Get a real-time quote for one or more stock tickers (e.g. NASDAQ:AAPL). Returns price, change, volume, market cap.",
        inputSchema: {
          tickers: z.array(z.string()).describe("Fully-qualified tickers, e.g. ['NASDAQ:AAPL', 'NYSE:MSFT']"),
        },
        handler: async (input): Promise<ToolResult> => {
          try {
            const rows = await scanStocks({
              tickers: input.tickers as string[],
              columns: ["close", "change", "change_abs", "volume", "market_cap_basic", "name", "description"],
            });
            return successResult(JSON.stringify(rows, null, 2));
          } catch (e) {
            return errorResult(`Quote failed: ${(e as Error).message}`);
          }
        },
      },
      {
        name: "tradingview_technicals",
        description: "Get technical indicators (RSI, MACD, moving averages, pivot points, etc.) for one or more stock tickers.",
        inputSchema: {
          tickers: z.array(z.string()).describe("Fully-qualified tickers"),
          timeframe: z.string().optional().describe("Timeframe (default: 1d)"),
        },
        handler: async (input): Promise<ToolResult> => {
          try {
            const technicalCols = [
              "Recommend.All", "Recommend.MA", "Recommend.Other",
              "RSI", "Stoch.K", "Stoch.D", "CCI20", "ADX", "ADX+DI", "ADX-DI",
              "AO", "Mom", "MACD.macd", "MACD.signal", "BB.lower", "BB.upper",
              "EMA20", "EMA50", "EMA200", "SMA20", "SMA50", "SMA200",
              "Pivot.M.Classic.S1", "Pivot.M.Classic.Middle", "Pivot.M.Classic.R1",
            ];
            const rows = await scanStocks({
              tickers: input.tickers as string[],
              columns: technicalCols,
              timeframe: input.timeframe as string | undefined,
            });
            return successResult(JSON.stringify(rows, null, 2));
          } catch (e) {
            return errorResult(`Technicals failed: ${(e as Error).message}`);
          }
        },
      },
      {
        name: "tradingview_top_gainers",
        description: "Get today's top gaining stocks by percentage change on a given exchange. Defaults to major US exchanges (NYSE, NASDAQ, AMEX) with market cap > $100M.",
        inputSchema: {
          exchange: z.string().optional().describe("Exchange (default: all US)"),
          limit: z.number().optional().describe("Max results (default 20)"),
        },
        handler: async (input): Promise<ToolResult> => {
          try {
            const filters = [
              { left: "market_cap_basic", operation: "greater", right: 100_000_000 },
            ];
            const rows = await scanStocks({
              exchange: input.exchange as string | undefined,
              columns: ["close", "change", "change_abs", "volume", "name", "description", "market_cap_basic"],
              filters,
              limit: (input.limit as number | undefined) ?? 20,
            });
            return successResult(JSON.stringify(rows, null, 2));
          } catch (e) {
            return errorResult(`Top gainers failed: ${(e as Error).message}`);
          }
        },
      },
      {
        name: "tradingview_top_volume",
        description: "Get stocks with the highest trading volume today. Defaults to major US exchanges.",
        inputSchema: {
          exchange: z.string().optional().describe("Exchange (default: all US)"),
          include_otc: z.boolean().optional().describe("Whether to include OTC penny stocks (default: false)"),
          limit: z.number().optional().describe("Max results (default 20)"),
        },
        handler: async (input): Promise<ToolResult> => {
          try {
            const filters = [];
            if (!input.include_otc) {
              filters.push({ left: "market_cap_basic", operation: "greater", right: 100_000_000 });
            }
            const rows = await scanStocks({
              exchange: input.exchange as string | undefined,
              columns: ["volume", "close", "change", "name", "description", "market_cap_basic"],
              filters,
              limit: (input.limit as number | undefined) ?? 20,
            });
            return successResult(JSON.stringify(rows, null, 2));
          } catch (e) {
            return errorResult(`Top volume failed: ${(e as Error).message}`);
          }
        },
      },
      {
        name: "tradingview_volume_breakout",
        description: "Find stocks with unusual volume (current volume significantly above average). Defaults to major exchanges.",
        inputSchema: {
          exchange: z.string().optional().describe("Exchange filter"),
          limit: z.number().optional().describe("Max results (default 20)"),
        },
        handler: async (input): Promise<ToolResult> => {
          try {
            const rows = await scanStocks({
              exchange: input.exchange as string | undefined,
              columns: ["volume", "close", "change", "name", "description", "market_cap_basic", "RSI", "MACD.macd"],
              filters: [
                { left: "volume", operation: "greater", right: 1_000_000 },
                { left: "market_cap_basic", operation: "greater", right: 100_000_000 }
              ],
              limit: (input.limit as number | undefined) ?? 20,
            });
            return successResult(JSON.stringify(rows, null, 2));
          } catch (e) {
            return errorResult(`Volume breakout failed: ${(e as Error).message}`);
          }
        },
      },
    ],
  };
}
