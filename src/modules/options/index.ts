import { z } from "zod";
import type { ModuleDefinition, ToolDefinition } from "../../shared/types.js";
import { successResult, errorResult } from "../../shared/types.js";
import { fetchOptionChain } from "./client.js";
import { withMetadata } from "../../shared/utils.js";

const expirationsTool: ToolDefinition = {
  name: "options_expirations",
  description: "Get all available option expiration dates for a stock ticker.",
  inputSchema: z.object({
    symbol: z.string().describe("Stock ticker symbol (e.g. 'AAPL')"),
  }),
  handler: withMetadata(async (params) => {
    const chain = await fetchOptionChain(params.symbol as string);
    const dates = chain.expirationDates.map(d => new Date(d * 1000).toISOString().split('T')[0]);
    return successResult(JSON.stringify({
      symbol: chain.underlyingSymbol,
      underlyingPrice: chain.underlyingPrice,
      expirations: dates,
      expirationTimestamps: chain.expirationDates,
    }, null, 2));
  }, { source: "yahoo-finance", dataDelay: "real-time" }),
};

const chainTool: ToolDefinition = {
  name: "options_chain",
  description: "Get the full option chain (calls and puts) for a specific ticker and expiration date. Includes calculated Greeks (Delta, Gamma, Theta, Vega).",
  inputSchema: z.object({
    symbol: z.string().describe("Stock ticker symbol (e.g. 'AAPL')"),
    expiration: z.number().optional().describe("Unix timestamp for expiration date. If omitted, uses the nearest date."),
  }),
  handler: withMetadata(async (params) => {
    const chain = await fetchOptionChain(params.symbol as string, params.expiration as number | undefined);
    return successResult(JSON.stringify(chain, null, 2));
  }, { source: "yahoo-finance", dataDelay: "real-time" }),
};

const maxPainTool: ToolDefinition = {
  name: "options_max_pain",
  description: "Get the calculated Max Pain strike price for a stock at a specific expiration. Max Pain is the strike where options buyers lose the most money.",
  inputSchema: z.object({
    symbol: z.string().describe("Stock ticker symbol (e.g. 'AAPL')"),
    expiration: z.number().optional().describe("Unix timestamp for expiration date."),
  }),
  handler: withMetadata(async (params) => {
    const chain = await fetchOptionChain(params.symbol as string, params.expiration as number | undefined);
    return successResult(JSON.stringify({
      symbol: chain.underlyingSymbol,
      underlyingPrice: chain.underlyingPrice,
      expiration: new Date((params.expiration || chain.expirationDates[0]) * 1000).toISOString().split('T')[0],
      maxPain: chain.maxPain,
    }, null, 2));
  }, { source: "yahoo-finance", dataDelay: "real-time" }),
};

export function createOptionsModule(): ModuleDefinition {
  return {
    name: "options",
    description: "Stock options data and Greeks analysis from Yahoo Finance (no API key required)",
    requiredEnvVars: [],
    tools: [expirationsTool, chainTool, maxPainTool],
  };
}
