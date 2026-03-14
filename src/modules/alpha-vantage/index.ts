import { z } from "zod";
import type { ModuleDefinition } from "../../shared/types.js";
import { successResult } from "../../shared/types.js";
import { getQuote, getDailyPrices, getOverview, getEarningsHistory } from "./client.js";
import { resolveTicker } from "../../shared/resolver.js";
import { withMetadata } from "../../shared/utils.js";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createAlphaVantageModule(apiKey: string): ModuleDefinition {
  const metadata = { source: "alpha-vantage", dataDelay: "real-time" };

  const quoteTool = {
    name: "alphavantage_quote",
    description: "Get real-time stock quote from Alpha Vantage. Returns price, change, volume, and day range. Rate limit: 5 calls/min on free tier.",
    inputSchema: z.object({
      symbol: z.string().describe("Stock ticker symbol (e.g. 'AAPL', 'MSFT')"),
    }),
    handler: withMetadata(async (params) => {
      const symbol = resolveTicker(params.symbol as string).ticker;
      const quote = await getQuote(apiKey, symbol);
      return successResult(JSON.stringify(quote, null, 2));
    }, metadata),
  };

  const dailyTool = {
    name: "alphavantage_daily",
    description: "Get daily OHLCV price history from Alpha Vantage. Returns up to 100 most recent trading days.",
    inputSchema: z.object({
      symbol: z.string().describe("Stock ticker symbol (e.g. 'AAPL')"),
      limit: z.number().optional().describe("Number of days to return (default: 30, max: 100)"),
    }),
    handler: withMetadata(async (params) => {
      const symbol = resolveTicker(params.symbol as string).ticker;
      const prices = await getDailyPrices(
        apiKey,
        symbol,
        Math.min((params.limit as number) ?? 30, 100),
      );
      return successResult(JSON.stringify(prices, null, 2));
    }, metadata),
  };

  const overviewTool = {
    name: "alphavantage_overview",
    description: "Get company fundamentals from Alpha Vantage. Includes PE ratio, market cap, sector, industry, earnings, and analyst target price. Supports batch requests (limit 5).",
    inputSchema: z.object({
      symbols: z.union([z.string(), z.array(z.string())]).describe("One or more stock symbols (e.g. 'AAPL' or ['AAPL', 'MSFT'])"),
    }),
    handler: withMetadata(async (params) => {
      const inputSymbols = Array.isArray(params.symbols) ? params.symbols : [params.symbols as string];
      const tickers = inputSymbols.map(s => resolveTicker(s).ticker);
      const results = [];

      for (let i = 0; i < Math.min(tickers.length, 5); i++) {
        if (i > 0) await sleep(12000); // 12s delay to respect 5/min rate limit
        const overview = await getOverview(apiKey, tickers[i]);
        results.push(overview);
      }

      return successResult(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
    }, metadata),
  };

  const earningsHistoryTool = {
    name: "alphavantage_earnings_history",
    description: "Get historical earnings data (EPS actual vs estimate) for a specific ticker.",
    inputSchema: z.object({
      symbol: z.string().describe("Stock ticker symbol (e.g. 'AAPL')"),
      limit: z.number().optional().describe("Number of quarters to return (default: 8, max: 20)"),
    }),
    handler: withMetadata(async (params) => {
      const symbol = resolveTicker(params.symbol as string).ticker;
      const earnings = await getEarningsHistory(
        apiKey,
        symbol,
        Math.min((params.limit as number) ?? 8, 20),
      );
      return successResult(JSON.stringify(earnings, null, 2));
    }, metadata),
  };

  return {
    name: "alpha-vantage",
    description: "Alpha Vantage stock data -- quotes, daily prices, and company fundamentals",
    requiredEnvVars: ["ALPHA_VANTAGE_API_KEY"],
    tools: [quoteTool, dailyTool, overviewTool, earningsHistoryTool],
  };
}
