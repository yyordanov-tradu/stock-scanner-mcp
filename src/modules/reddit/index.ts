import { z } from "zod";
import type { ModuleDefinition } from "../../shared/types.js";
import { successResult } from "../../shared/types.js";
import { getTrendingTickers, getTickerMentions, getTickerSentiment } from "./client.js";
import { withMetadata } from "../../shared/utils.js";

const trendingTool = {
  name: "reddit_trending",
  description:
    "Get trending stock tickers from Reddit based on mention frequency. " +
    "Scans r/wallstreetbets, r/stocks, r/investing, and r/options for posts mentioning tickers. " +
    "Returns tickers sorted by mention count with per-subreddit breakdown. " +
    "Limitation: uses keyword extraction (cashtags + uppercase words), not NLP — " +
    "some false positives possible. Best for gauging retail buzz, not precise sentiment.",
  inputSchema: z.object({
    subreddits: z.array(z.string()).optional()
      .describe("Subreddits to scan (default: wallstreetbets, stocks, investing, options)"),
    limit: z.number().default(20)
      .describe("Maximum number of trending tickers to return (default: 20)"),
  }),
  readOnly: true,
  handler: withMetadata(async (args: { subreddits?: string[]; limit?: number }) => {
    const result = await getTrendingTickers(args.subreddits, args.limit ?? 20);
    return successResult(JSON.stringify(result, null, 2));
  }, { source: "reddit", dataDelay: "real-time" }),
};

const mentionsTool = {
  name: "reddit_mentions",
  description:
    "Get mention count and top posts for a specific stock ticker across Reddit. " +
    "Searches r/wallstreetbets, r/stocks, r/investing, and r/options. " +
    "Returns total mentions, per-subreddit breakdown, and top 10 posts by score. " +
    "Use this to check how much retail attention a ticker is getting.",
  inputSchema: z.object({
    symbol: z.string().describe("Stock ticker symbol (e.g. AAPL, TSLA, GME)"),
    period: z.enum(["hour", "day", "week"]).default("day")
      .describe("Time period to search (default: day)"),
  }),
  readOnly: true,
  handler: withMetadata(async (args: { symbol: string; period?: string }) => {
    const result = await getTickerMentions(args.symbol, args.period ?? "day");
    return successResult(JSON.stringify(result, null, 2));
  }, { source: "reddit", dataDelay: "real-time" }),
};

const sentimentTool = {
  name: "reddit_sentiment",
  description:
    "Get sentiment analysis for a stock ticker from Reddit discussions. " +
    "Searches r/wallstreetbets, r/stocks, r/investing, and r/options, then scores each post " +
    "using keyword matching (bullish terms like 'moon', 'calls', 'breakout' vs " +
    "bearish terms like 'crash', 'puts', 'dump'). " +
    "Returns bullish/bearish/neutral counts, average sentiment score, and sample posts. " +
    "Limitation: keyword-based scoring, not NLP — sarcasm and context may be missed.",
  inputSchema: z.object({
    symbol: z.string().describe("Stock ticker symbol (e.g. AAPL, TSLA, GME)"),
    limit: z.number().default(50)
      .describe("Maximum posts to analyze per subreddit (default: 50)"),
  }),
  readOnly: true,
  handler: withMetadata(async (args: { symbol: string; limit?: number }) => {
    const result = await getTickerSentiment(args.symbol, args.limit ?? 50);
    return successResult(JSON.stringify(result, null, 2));
  }, { source: "reddit", dataDelay: "real-time" }),
};

export function createRedditModule(): ModuleDefinition {
  return {
    name: "reddit",
    description: "Reddit sentiment — trending tickers, mention tracking, and sentiment analysis from popular investing subreddits",
    requiredEnvVars: [],
    tools: [trendingTool, mentionsTool, sentimentTool],
  };
}
