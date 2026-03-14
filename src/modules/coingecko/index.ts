import { z } from "zod";
import type { ModuleDefinition } from "../../shared/types.js";
import { successResult } from "../../shared/types.js";
import { getCoinDetail, getTrending, getGlobal } from "./client.js";
import { withMetadata } from "../../shared/utils.js";

const coinTool = {
  name: "coingecko_coin",
  description: "Get detailed cryptocurrency info from CoinGecko. Use slug IDs (e.g. 'bitcoin', 'ethereum', 'solana'), NOT ticker symbols.",
  inputSchema: z.object({
    coinId: z.string().describe("CoinGecko coin ID / slug (e.g. 'bitcoin', 'ethereum', 'cardano')"),
  }),
  handler: withMetadata(async (params) => {
    const coin = await getCoinDetail(params.coinId as string);
    return successResult(JSON.stringify(coin, null, 2));
  }, { source: "coingecko", dataDelay: "real-time" }),
};

const trendingTool = {
  name: "coingecko_trending",
  description: "Get trending cryptocurrencies on CoinGecko (top 7 by search popularity in last 24h).",
  inputSchema: z.object({}),
  handler: withMetadata(async () => {
    const trending = await getTrending();
    return successResult(JSON.stringify(trending, null, 2));
  }, { source: "coingecko", dataDelay: "real-time" }),
};

const globalTool = {
  name: "coingecko_global",
  description: "Get global cryptocurrency market statistics: total market cap, 24h volume, BTC/ETH dominance.",
  inputSchema: z.object({}),
  handler: withMetadata(async () => {
    const global = await getGlobal();
    return successResult(JSON.stringify(global, null, 2));
  }, { source: "coingecko", dataDelay: "real-time" }),
};

export function createCoingeckoModule(): ModuleDefinition {
  return {
    name: "coingecko",
    description: "CoinGecko crypto data -- coin details, trending coins, and global market stats",
    requiredEnvVars: [],
    tools: [coinTool, trendingTool, globalTool],
  };
}
