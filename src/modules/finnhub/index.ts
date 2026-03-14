import { z } from "zod";
import type { ModuleDefinition, ToolDefinition } from "../../shared/types.js";
import { successResult, errorResult } from "../../shared/types.js";
import {
  getMarketNews,
  getCompanyNews,
  getEarningsCalendar,
  getAnalystRecommendations,
  getPriceTarget,
} from "./client.js";

const marketNewsTool: ToolDefinition = {
  name: "finnhub_market_news",
  description: "Get latest market news by category (general, forex, crypto, merger).",
  inputSchema: {
    category: z.string().optional().describe("Category: general, forex, crypto, merger"),
    limit: z.number().optional().describe("Max results (default: 20, max: 50)"),
  },
  handler: async (params) => {
    try {
      const apiKey = process.env.FINNHUB_API_KEY!;
      const news = await getMarketNews(
        apiKey,
        params.category as string | undefined,
        Math.min((params.limit as number) ?? 20, 50),
      );
      return successResult(JSON.stringify(news, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

const companyNewsTool: ToolDefinition = {
  name: "finnhub_company_news",
  description: "Get recent news for a specific company by ticker symbol.",
  inputSchema: {
    symbol: z.string().describe("Stock symbol (e.g. 'AAPL')"),
    from: z.string().describe("From date (YYYY-MM-DD)"),
    to: z.string().describe("To date (YYYY-MM-DD)"),
    limit: z.number().optional().describe("Max results (default: 20, max: 50)"),
  },
  handler: async (params) => {
    try {
      const apiKey = process.env.FINNHUB_API_KEY!;
      const news = await getCompanyNews(
        apiKey,
        params.symbol as string,
        params.from as string,
        params.to as string,
        Math.min((params.limit as number) ?? 20, 50),
      );
      return successResult(JSON.stringify(news, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

const earningsCalendarTool: ToolDefinition = {
  name: "finnhub_earnings_calendar",
  description: "Get upcoming or historical earnings reports within a date range.",
  inputSchema: {
    from: z.string().describe("Start date (YYYY-MM-DD)"),
    to: z.string().describe("End date (YYYY-MM-DD)"),
    symbol: z.string().optional().describe("Filter by specific symbol"),
    limit: z.number().optional().describe("Max results to return (default: 20, max: 100)"),
  },
  handler: async (params) => {
    try {
      const apiKey = process.env.FINNHUB_API_KEY!;
      const results = await getEarningsCalendar(
        apiKey,
        params.from as string,
        params.to as string,
      );
      
      let filtered = results;
      if (params.symbol) {
        const s = (params.symbol as string).toUpperCase();
        filtered = results.filter(r => r.symbol === s);
      }

      const limit = Math.min((params.limit as number) ?? 20, 100);
      const capped = filtered.slice(0, limit);

      return successResult(JSON.stringify(capped, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

const analystRatingsTool: ToolDefinition = {
  name: "finnhub_analyst_ratings",
  description: "Get analyst consensus recommendations and price targets for a stock.",
  inputSchema: {
    symbol: z.string().describe("Stock symbol (e.g. 'AAPL')"),
  },
  handler: async (params) => {
    try {
      const apiKey = process.env.FINNHUB_API_KEY!;
      const symbol = (params.symbol as string).toUpperCase();
      
      const [recs, target] = await Promise.all([
        getAnalystRecommendations(apiKey, symbol),
        getPriceTarget(apiKey, symbol),
      ]);

      return successResult(JSON.stringify({
        symbol,
        currentConsensus: recs[0] || null,
        priceTarget: target,
        recommendationHistory: recs.slice(0, 4),
      }, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

export function createFinnhubModule(_apiKey?: string): ModuleDefinition {
  return {
    name: "finnhub",
    description:
      "Finnhub market and company news, plus earnings calendar and analyst ratings",
    requiredEnvVars: ["FINNHUB_API_KEY"],
    tools: [
      marketNewsTool, 
      companyNewsTool, 
      earningsCalendarTool, 
      analystRatingsTool
    ],
  };
}
