import { z } from "zod";
import type { ModuleDefinition, ToolDefinition } from "../../shared/types.js";
import { successResult, errorResult } from "../../shared/types.js";
import {
  getMarketNews,
  getCompanyNews,
  getEarningsCalendar,
} from "./client.js";

export function createFinnhubModule(apiKey: string): ModuleDefinition {
  const marketNewsTool: ToolDefinition = {
    name: "finnhub_market_news",
    description:
      "Get latest market news from Finnhub. Returns top 20 articles with headlines, summaries, and URLs.",
    inputSchema: {
      category: z
        .string()
        .optional()
        .describe(
          "News category: 'general', 'forex', 'crypto', 'merger'. Default: 'general'",
        ),
    },
    handler: async (params) => {
      try {
        const news = await getMarketNews(
          apiKey,
          (params.category as string) ?? "general",
        );
        return successResult(JSON.stringify(news, null, 2));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  };

  const companyNewsTool: ToolDefinition = {
    name: "finnhub_company_news",
    description:
      "Get news for a specific company from Finnhub. Requires date range.",
    inputSchema: {
      symbol: z.string().describe("Stock ticker symbol (e.g. 'AAPL')"),
      from: z.string().describe("Start date in YYYY-MM-DD format"),
      to: z.string().describe("End date in YYYY-MM-DD format"),
    },
    handler: async (params) => {
      try {
        const news = await getCompanyNews(
          apiKey,
          params.symbol as string,
          params.from as string,
          params.to as string,
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

  return {
    name: "finnhub",
    description:
      "Finnhub market and company news, plus earnings calendar",
    requiredEnvVars: ["FINNHUB_API_KEY"],
    tools: [marketNewsTool, companyNewsTool, earningsCalendarTool],
  };
}
