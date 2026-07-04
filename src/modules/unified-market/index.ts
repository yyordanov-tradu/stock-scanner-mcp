import { z } from "zod";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { Config } from "../../config.js";
import { withMetadata } from "../../shared/utils.js";
import { routeGetQuote, routeGetProfile, routeGetTechnicals } from "./client.js";

// Input Schemas
export const getQuoteSchema = z.object({
  symbol: z.string().describe("Stock ticker or crypto pair (e.g., 'AAPL', 'BTCUSDT', 'NYSE:IBM')"),
});

export const getProfileSchema = z.object({
  symbol: z.string().describe("Stock ticker (e.g., 'AAPL')"),
});

export const getTechnicalsSchema = z.object({
  symbol: z.string().describe("Stock ticker or crypto pair (e.g., 'AAPL', 'BTCUSDT')"),
});

export function createUnifiedMarketModule(config: Config) {
  const metadata = { source: "unified-market", dataDelay: "real-time" };

  const getQuoteTool = {
    name: "market_get_quote",
    description: "Get current price, change, volume, and day high/low for a given symbol. Automatically routes to the best available data provider (Finnhub, Alpha Vantage, or TradingView).",
    inputSchema: getQuoteSchema,
    readOnly: true,
    handler: withMetadata(async (params: any) => {
      const data = await routeGetQuote(params.symbol, config);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }, metadata),
  };

  const getProfileTool = {
    name: "market_get_profile",
    description: "Get general company metrics, exchange, description, and capitalization. Automatically routes to the best available data provider.",
    inputSchema: getProfileSchema,
    readOnly: true,
    handler: withMetadata(async (params: any) => {
      const data = await routeGetProfile(params.symbol, config);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }, metadata),
  };

  const getTechnicalsTool = {
    name: "market_get_technicals",
    description: "Get common technical indicators (RSI, moving averages, etc.) for a given symbol. Currently powered by TradingView.",
    inputSchema: getTechnicalsSchema,
    readOnly: true,
    handler: withMetadata(async (params: any) => {
      const data = await routeGetTechnicals(params.symbol);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }, metadata),
  };

  return {
    name: "unified-market",
    description: "Smart provider routing for quotes, profiles, and technicals across Finnhub, Alpha Vantage, and TradingView.",
    requiredEnvVars: [],
    tools: [getQuoteTool, getProfileTool, getTechnicalsTool],
  };
}
