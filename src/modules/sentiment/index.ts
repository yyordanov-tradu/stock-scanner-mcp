import { z } from "zod";
import type { ModuleDefinition } from "../../shared/types.js";
import { successResult } from "../../shared/types.js";
import { getFearAndGreed, getCryptoFearAndGreed } from "./client.js";
import { withMetadata } from "../../shared/utils.js";

const fearGreedTool = {
  name: "sentiment_fear_greed",
  description:
    "Get the CNN Fear & Greed Index for the US stock market. " +
    "Returns a composite score (0-100) with rating (extreme fear/fear/neutral/greed/extreme greed) " +
    "and 7 sub-indicators: S&P 500 momentum, stock price strength (52w highs vs lows), " +
    "stock price breadth (McClellan), put/call ratio, VIX, junk bond demand, safe haven demand. " +
    "Also includes previous close, 1-week, 1-month, and 1-year scores for trend context. " +
    "Use this to gauge overall market sentiment before analyzing individual stocks.",
  inputSchema: z.object({}),
  readOnly: true,
  handler: withMetadata(async () => {
    const result = await getFearAndGreed();
    return successResult(JSON.stringify(result, null, 2));
  }, { source: "cnn-fear-greed", dataDelay: "end of day" }),
};

const cryptoFearGreedTool = {
  name: "sentiment_crypto_fear_greed",
  description:
    "Get the Crypto Fear & Greed Index from Alternative.me. " +
    "Returns a score (0-100) with rating (extreme fear/fear/neutral/greed/extreme greed). " +
    "Based on Bitcoin volatility, market volume, social media, surveys, dominance, and trends. " +
    "Use this alongside coingecko tools for crypto market context.",
  inputSchema: z.object({}),
  readOnly: true,
  handler: withMetadata(async () => {
    const result = await getCryptoFearAndGreed();
    return successResult(JSON.stringify(result, null, 2));
  }, { source: "alternative-me", dataDelay: "daily" }),
};

export function createSentimentModule(): ModuleDefinition {
  return {
    name: "sentiment",
    description: "Market sentiment — CNN Fear & Greed Index and crypto sentiment",
    requiredEnvVars: [],
    tools: [fearGreedTool, cryptoFearGreedTool],
  };
}
