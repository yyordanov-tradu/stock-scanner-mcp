import { z } from "zod";
import type { ModuleDefinition } from "../../shared/types.js";
import { successResult } from "../../shared/types.js";
import { getTrendingTickers, getTickerMentions, getTickerSentiment, scanWatchlist, DEFAULT_SUBREDDITS } from "./client.js";
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
    subreddits: z.array(z.string()).max(10).optional()
      .describe("Subreddits to scan (default: wallstreetbets, stocks, investing, options)"),
    limit: z.number().min(1).max(50).default(20)
      .describe("Maximum number of trending tickers to return (default: 20)"),
  }),
  readOnly: true,
  handler: withMetadata(async (args: { subreddits?: string[]; limit?: number }) => {
    const result = await getTrendingTickers(args.subreddits ?? [...DEFAULT_SUBREDDITS], args.limit ?? 20);
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
    symbol: z.string().max(10).describe("Stock ticker symbol (e.g. AAPL, TSLA, GME)"),
    period: z.enum(["hour", "day", "week"]).default("day")
      .describe("Time period to search (default: day)"),
  }),
  readOnly: true,
  handler: withMetadata(async (args: { symbol: string; period?: string }) => {
    const result = await getTickerMentions(args.symbol.toUpperCase(), args.period ?? "day");
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
    symbol: z.string().max(10).describe("Stock ticker symbol (e.g. AAPL, TSLA, GME)"),
    limit: z.number().min(1).max(100).default(50)
      .describe("Maximum posts to analyze per subreddit (default: 50)"),
  }),
  readOnly: true,
  handler: withMetadata(async (args: { symbol: string; limit?: number }) => {
    const result = await getTickerSentiment(args.symbol.toUpperCase(), args.limit ?? 50);
    return successResult(JSON.stringify(result, null, 2));
  }, { source: "reddit", dataDelay: "real-time" }),
};

const watchlistScanTool = {
  name: "reddit_watchlist_scan",
  description:
    "Batch Reddit sentiment scan for a list of stock tickers in a single pass. " +
    "Combines the tickers into one OR query per subreddit (r/wallstreetbets, r/stocks, " +
    "r/investing, r/options), costing ceil(symbols/20)×4 requests instead of one call per " +
    "ticker — prefer this over calling reddit_mentions or reddit_sentiment for each symbol " +
    "in a watchlist. Returns, per ticker: mention count, bullish/bearish/neutral sentiment " +
    "breakdown with an average score, the top post by upvotes, and a 'hot' flag (true when a " +
    "ticker has 5 or more mentions in the period). " +
    "Limitations: keyword-based scoring, not NLP (sarcasm/context may be missed); sentiment is " +
    "scored per-post, not per-ticker, so a multi-ticker post applies the same score to each " +
    "matched symbol; symbols that collide with common English words/finance acronyms " +
    "(e.g. REAL, OPEN, HOLD, SELL) or fall outside 2–5 uppercase characters may report zero " +
    "mentions even when discussed; and because each subreddit's combined query shares one " +
    "100-post cap, heavily-discussed tickers in a large batch can crowd out quieter ones, so " +
    "counts may run lower than a single-ticker reddit_mentions query. Results cached for 5 minutes.",
  inputSchema: z.object({
    symbols: z.array(z.string().max(10)).min(1).max(50)
      .describe("Watchlist stock tickers to scan, e.g. ['AAPL', 'NVDA', 'TSLA'] (1–50 symbols)"),
    period: z.enum(["hour", "day", "week"]).default("day")
      .describe("Time window to search Reddit posts (default: day)"),
  }),
  readOnly: true,
  handler: withMetadata(async (args: { symbols: string[]; period?: string }) => {
    const result = await scanWatchlist(args.symbols, args.period ?? "day");
    return successResult(JSON.stringify(result, null, 2));
  }, { source: "reddit", dataDelay: "real-time" }),
};

export function createRedditModule(): ModuleDefinition {
  return {
    name: "reddit",
    description: "Reddit sentiment — trending tickers, mention tracking, and sentiment analysis from popular investing subreddits",
    requiredEnvVars: [],
    tools: [trendingTool, mentionsTool, sentimentTool, watchlistScanTool],
  };
}
