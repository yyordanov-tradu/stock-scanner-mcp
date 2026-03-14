import { z } from "zod";
import type { ModuleDefinition, ToolDefinition } from "../../shared/types.js";
import { successResult, errorResult } from "../../shared/types.js";
import { getQuote, getDailyPrices, getOverview, getEarningsHistory } from "./client.js";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createAlphaVantageModule(apiKey: string): ModuleDefinition {
  const quoteTool: ToolDefinition = {
    name: "alphavantage_quote",
    description: "Get real-time stock quote from Alpha Vantage. Returns price, change, volume, and day range. Rate limit: 5 calls/min on free tier.",
    inputSchema: {
      symbol: z.string().describe("Stock ticker symbol (e.g. 'AAPL', 'MSFT')"),
    },
    handler: async (params) => {
      try {
        const quote = await getQuote(apiKey, params.symbol as string);
        return successResult(JSON.stringify(quote, null, 2));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  };

  const dailyTool: ToolDefinition = {
    name: "alphavantage_daily",
    description: "Get daily OHLCV price history from Alpha Vantage. Returns up to 100 most recent trading days.",
    inputSchema: {
      symbol: z.string().describe("Stock ticker symbol (e.g. 'AAPL')"),
      limit: z.number().optional().describe("Number of days to return (default: 30, max: 100)"),
    },
    handler: async (params) => {
      try {
        const prices = await getDailyPrices(
          apiKey,
          params.symbol as string,
          Math.min((params.limit as number) ?? 30, 100),
        );
        return successResult(JSON.stringify(prices, null, 2));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  };

  const overviewTool: ToolDefinition = {
    name: "alphavantage_overview",
    description: "Get company fundamentals from Alpha Vantage. Includes PE ratio, market cap, sector, industry, earnings, and analyst target price. Supports batch requests (limit 5).",
    inputSchema: {
      symbols: z.union([z.string(), z.array(z.string())]).describe("One or more stock symbols (e.g. 'AAPL' or ['AAPL', 'MSFT'])"),
    },
    handler: async (params) => {
      try {
        const symbols = Array.isArray(params.symbols) ? params.symbols : [params.symbols as string];
        const results = [];
        
        for (let i = 0; i < Math.min(symbols.length, 5); i++) {
          if (i > 0) await sleep(12000); // 12s delay to respect 5/min rate limit
          const overview = await getOverview(apiKey, symbols[i]);
          results.push(overview);
        }
        
        return successResult(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  };

  const earningsHistoryTool: ToolDefinition = {
    name: "alphavantage_earnings_history",
    description: "Get historical earnings data (EPS actual vs estimate) for a specific ticker.",
    inputSchema: {
      symbol: z.string().describe("Stock ticker symbol (e.g. 'AAPL')"),
      limit: z.number().optional().describe("Number of quarters to return (default: 8, max: 20)"),
    },
    handler: async (params) => {
      try {
        const earnings = await getEarningsHistory(
          apiKey,
          params.symbol as string,
          Math.min((params.limit as number) ?? 8, 20),
        );
        return successResult(JSON.stringify(earnings, null, 2));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  };

  return {
    name: "alpha-vantage",
    description: "Alpha Vantage stock data -- quotes, daily prices, and company fundamentals",
    requiredEnvVars: ["ALPHA_VANTAGE_API_KEY"],
    tools: [quoteTool, dailyTool, overviewTool, earningsHistoryTool],
  };
}
