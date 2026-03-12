import { z } from "zod";
import type { ModuleDefinition, ToolDefinition } from "../../shared/types.js";
import { successResult, errorResult } from "../../shared/types.js";
import { getCoinDetail, getTrending, getGlobal } from "./client.js";

const coinTool: ToolDefinition = {
  name: "coingecko_coin",
  description: "Get detailed cryptocurrency info from CoinGecko. Use slug IDs (e.g. 'bitcoin', 'ethereum', 'solana'), NOT ticker symbols.",
  inputSchema: {
    coinId: z.string().describe("CoinGecko coin ID / slug (e.g. 'bitcoin', 'ethereum', 'cardano')"),
  },
  handler: async (params) => {
    try {
      const coin = await getCoinDetail(params.coinId as string);
      return successResult(JSON.stringify(coin, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

const trendingTool: ToolDefinition = {
  name: "coingecko_trending",
  description: "Get trending cryptocurrencies on CoinGecko (top 7 by search popularity in last 24h).",
  inputSchema: {},
  handler: async () => {
    try {
      const trending = await getTrending();
      return successResult(JSON.stringify(trending, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

const globalTool: ToolDefinition = {
  name: "coingecko_global",
  description: "Get global cryptocurrency market statistics: total market cap, 24h volume, BTC/ETH dominance.",
  inputSchema: {},
  handler: async () => {
    try {
      const global = await getGlobal();
      return successResult(JSON.stringify(global, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

export function createCoingeckoModule(): ModuleDefinition {
  return {
    name: "coingecko",
    description: "CoinGecko crypto data -- coin details, trending coins, and global market stats",
    requiredEnvVars: [],
    tools: [coinTool, trendingTool, globalTool],
  };
}
