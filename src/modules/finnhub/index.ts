import { z } from "zod";
import type { ModuleDefinition, ToolDefinition } from "../../shared/types.js";
import { successResult } from "../../shared/types.js";
import {
  getMarketNews,
  getCompanyNews,
  getEarningsCalendar,
  getShortInterest,
  getAnalystRecommendations,
  getCompanyProfile,
  getPeers,
  getMarketStatus,
  getQuote,
} from "./client.js";
import { resolveTicker } from "../../shared/resolver.js";
import { withMetadata } from "../../shared/utils.js";

export function createFinnhubModule(apiKey: string): ModuleDefinition {
  const metadata = { source: "finnhub", dataDelay: "real-time" };

  const marketNewsTool: ToolDefinition = {
    name: "finnhub_market_news",
    description: "Get latest market news by category (general, forex, crypto, merger). Rate limit: 60 calls/min (free tier).",
    inputSchema: z.object({
      category: z.string().optional().describe("Category: general, forex, crypto, merger"),
      limit: z.number().optional().describe("Max results (default: 20, max: 50)"),
    }),
    readOnly: true,
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
    description: "Get recent news for a specific company by ticker symbol. Rate limit: 60 calls/min (free tier).",
    inputSchema: z.object({
      symbol: z.string().describe("Stock symbol (e.g. 'AAPL')"),
      from: z.string().describe("From date (YYYY-MM-DD)"),
      to: z.string().describe("To date (YYYY-MM-DD)"),
      limit: z.number().optional().describe("Max results (default: 20, max: 50)"),
    }),
    readOnly: true,
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
    description: "Get upcoming or historical earnings reports within a date range. Rate limit: 60 calls/min (free tier).",
    inputSchema: z.object({
      from: z.string().describe("Start date (YYYY-MM-DD)"),
      to: z.string().describe("End date (YYYY-MM-DD)"),
      symbol: z.string().optional().describe("Filter by specific symbol"),
      limit: z.number().optional().describe("Max results to return (default: 20, max: 100)"),
    }),
    readOnly: true,
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

  const analystRatingsTool: ToolDefinition = {
    name: "finnhub_analyst_ratings",
    description: "Get analyst consensus recommendations for a stock. Returns counts of Strong Buy, Buy, Hold, Sell, Strong Sell ratings and the last 4 months of rating history. Rate limit: 60 calls/min (free tier).",
    inputSchema: z.object({
      symbol: z.string().describe("Stock symbol (e.g. 'AAPL')"),
    }),
    readOnly: true,
    handler: withMetadata(async (params) => {
      const symbol = resolveTicker(params.symbol as string).ticker;
      const recs = await getAnalystRecommendations(apiKey, symbol);

      return successResult(JSON.stringify({
        symbol,
        currentConsensus: recs[0] || null,
        recommendationHistory: recs.slice(0, 4),
      }, null, 2));
    }, metadata),
  };

  const companyProfileTool: ToolDefinition = {
    name: "finnhub_company_profile",
    description: "Get company profile: name, industry, market cap, IPO date, logo, website, share count, and exchange. Rate limit: 60 calls/min (free tier).",
    inputSchema: z.object({
      symbol: z.string().describe("Stock symbol (e.g. 'AAPL')"),
    }),
    readOnly: true,
    handler: withMetadata(async (params) => {
      const symbol = resolveTicker(params.symbol as string).ticker;
      const profile = await getCompanyProfile(apiKey, symbol);
      return successResult(JSON.stringify(profile, null, 2));
    }, metadata),
  };

  const peersTool: ToolDefinition = {
    name: "finnhub_peers",
    description: "Get a list of peer/comparable companies in the same industry for a given stock. Rate limit: 60 calls/min (free tier).",
    inputSchema: z.object({
      symbol: z.string().describe("Stock symbol (e.g. 'AAPL')"),
    }),
    readOnly: true,
    handler: withMetadata(async (params) => {
      const symbol = resolveTicker(params.symbol as string).ticker;
      const peers = await getPeers(apiKey, symbol);
      return successResult(JSON.stringify({ symbol, peers }, null, 2));
    }, metadata),
  };

  const marketStatusTool: ToolDefinition = {
    name: "finnhub_market_status",
    description: "Check if a stock exchange is currently open, and what session it is in (pre-market, regular, post-market). Rate limit: 60 calls/min (free tier).",
    inputSchema: z.object({
      exchange: z.string().default("US").describe("Exchange code. Examples: US, L (London), T (Tokyo), HK"),
    }),
    readOnly: true,
    handler: withMetadata(async (params) => {
      const exchange = params.exchange as string;
      const status = await getMarketStatus(apiKey, exchange);
      return successResult(JSON.stringify(status, null, 2));
    }, metadata),
  };

  const quoteTool: ToolDefinition = {
    name: "finnhub_quote",
    description: "Get a real-time stock quote from Finnhub (requires API key): current price, change, percent change, day high/low, open, and previous close. Preferred over tradingview_quote during market hours for live prices. Use tradingview_quote as a keyless fallback when Finnhub is unavailable. Rate limit: 60 calls/min (free tier).",
    inputSchema: z.object({
      symbol: z.string().describe("Stock symbol (e.g. 'AAPL')"),
    }),
    readOnly: true,
    handler: withMetadata(async (params) => {
      const symbol = resolveTicker(params.symbol as string).ticker;
      const q = await getQuote(apiKey, symbol);
      return successResult(JSON.stringify({
        symbol,
        price: q.c,
        change: q.d,
        changePercent: q.dp,
        dayHigh: q.h,
        dayLow: q.l,
        open: q.o,
        previousClose: q.pc,
      }, null, 2));
    }, metadata),
  };

  const shortInterestTool: ToolDefinition = {
    name: "finnhub_short_interest",
    description: "Get short interest and other key financial metrics for a stock. Rate limit: 60 calls/min (free tier).",
    inputSchema: z.object({
      symbol: z.string().describe("Stock symbol (e.g. 'AAPL')"),
    }),
    readOnly: true,
    handler: withMetadata(async (params) => {
      const symbol = resolveTicker(params.symbol as string).ticker;
      const metrics = await getShortInterest(apiKey, symbol);
      return successResult(JSON.stringify(metrics, null, 2));
    }, metadata),
  };

  return {
    name: "finnhub",
    description:
      "Finnhub market data: quotes, company profiles, peers, news, earnings, analyst ratings, short interest, and market status",
    requiredEnvVars: ["FINNHUB_API_KEY"],
    tools: [
      quoteTool,
      companyProfileTool,
      peersTool,
      marketStatusTool,
      marketNewsTool,
      companyNewsTool,
      earningsCalendarTool,
      analystRatingsTool,
      shortInterestTool,
    ],
  };
}
