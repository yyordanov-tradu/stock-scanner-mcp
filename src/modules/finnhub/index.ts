import { z } from "zod";
import type { ModuleDefinition, ToolDefinition } from "../../shared/types.js";
import { successResult } from "../../shared/types.js";
import {
  getMarketNews,
  getCompanyNews,
  getEarningsCalendar,
  getShortInterest,
  getEconomicCalendar,
} from "./client.js";
import { resolveTicker } from "../../shared/resolver.js";
import { withMetadata } from "../../shared/utils.js";

export function createFinnhubModule(apiKey: string): ModuleDefinition {
  const metadata = { source: "finnhub", dataDelay: "real-time" };

  const marketNewsTool: ToolDefinition = {
    name: "finnhub_market_news",
    description: "Get latest market news by category (general, forex, crypto, merger).",
    inputSchema: z.object({
      category: z.string().optional().describe("Category: general, forex, crypto, merger"),
      limit: z.number().optional().describe("Max results (default: 20, max: 50)"),
    }),
    handler: withMetadata(async (params) => {
      const news = await getMarketNews(
        apiKey,
        params.category as string | undefined,
        Math.min((params.limit as number) ?? 20, 50),
      );
      return successResult(JSON.stringify(news, null, 2));
    }, metadata),
  };

  const companyNewsTool: ToolDefinition = {
    name: "finnhub_company_news",
    description: "Get recent news for a specific company by ticker symbol.",
    inputSchema: z.object({
      symbol: z.string().describe("Stock symbol (e.g. 'AAPL')"),
      from: z.string().describe("From date (YYYY-MM-DD)"),
      to: z.string().describe("To date (YYYY-MM-DD)"),
      limit: z.number().optional().describe("Max results (default: 20, max: 50)"),
    }),
    handler: withMetadata(async (params) => {
      const symbol = resolveTicker(params.symbol as string).ticker;
      const news = await getCompanyNews(
        apiKey,
        symbol,
        params.from as string,
        params.to as string,
        Math.min((params.limit as number) ?? 20, 50),
      );
      return successResult(JSON.stringify(news, null, 2));
    }, metadata),
  };

  const earningsCalendarTool: ToolDefinition = {
    name: "finnhub_earnings_calendar",
    description: "Get upcoming or historical earnings reports within a date range.",
    inputSchema: z.object({
      from: z.string().describe("Start date (YYYY-MM-DD)"),
      to: z.string().describe("End date (YYYY-MM-DD)"),
      symbol: z.string().optional().describe("Filter by specific symbol"),
      limit: z.number().optional().describe("Max results to return (default: 20, max: 100)"),
    }),
    handler: withMetadata(async (params) => {
      const symbol = params.symbol
        ? resolveTicker(params.symbol as string).ticker
        : undefined;

      const results = await getEarningsCalendar(
        apiKey,
        params.from as string,
        params.to as string,
        symbol,
      );

      const limit = Math.min((params.limit as number) ?? 20, 100);
      const capped = results.slice(0, limit);

      return successResult(JSON.stringify(capped, null, 2));
    }, metadata),
  };

  const shortInterestTool: ToolDefinition = {
    name: "finnhub_short_interest",
    description: "Get short interest and other key financial metrics for a stock.",
    inputSchema: z.object({
      symbol: z.string().describe("Stock symbol (e.g. 'AAPL')"),
    }),
    handler: withMetadata(async (params) => {
      const symbol = resolveTicker(params.symbol as string).ticker;
      const metrics = await getShortInterest(apiKey, symbol);
      return successResult(JSON.stringify(metrics, null, 2));
    }, metadata),
  };

  const economicCalendarTool: ToolDefinition = {
    name: "finnhub_economic_calendar",
    description:
      "Get upcoming and recent economic events (FOMC, CPI, GDP, NFP, etc.) with actual/estimate/previous values and impact ratings. Essential for understanding macro catalysts that move markets, crypto, and correlated assets.",
    inputSchema: z.object({
      from: z.string().describe("Start date (YYYY-MM-DD)"),
      to: z.string().describe("End date (YYYY-MM-DD)"),
      country: z.string().optional().describe("Filter by country code (e.g. 'US', 'EU', 'GB'). Default: all countries"),
      impact: z.string().optional().describe("Filter by impact: 'high', 'medium', 'low'. Default: all"),
      limit: z.number().optional().describe("Max results (default: 50, max: 200)"),
    }),
    handler: withMetadata(async (params) => {
      const events = await getEconomicCalendar(
        apiKey,
        params.from as string,
        params.to as string,
      );

      let filtered = events;

      if (params.country) {
        const country = (params.country as string).toUpperCase();
        filtered = filtered.filter(e => e.country === country);
      }

      if (params.impact) {
        const impact = (params.impact as string).toLowerCase();
        filtered = filtered.filter(e => e.impact === impact);
      }

      const limit = Math.min((params.limit as number) ?? 50, 200);
      const capped = filtered.slice(0, limit);

      return successResult(JSON.stringify(capped, null, 2));
    }, metadata),
  };

  return {
    name: "finnhub",
    description:
      "Finnhub market and company news, plus earnings calendar, short interest, and economic calendar",
    requiredEnvVars: ["FINNHUB_API_KEY"],
    tools: [
      marketNewsTool,
      companyNewsTool,
      earningsCalendarTool,
      shortInterestTool,
      economicCalendarTool,
    ],
  };
}
