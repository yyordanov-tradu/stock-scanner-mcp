import { z } from "zod";
import type { ModuleDefinition, ToolDefinition } from "../../shared/types.js";
import { successResult } from "../../shared/types.js";
import { getExpirations, getOptionsChain } from "./client.js";
import { calculateMaxPain } from "./max-pain.js";
import { withMetadata } from "../../shared/utils.js";
import { resolveTicker } from "../../shared/resolver.js";

const symbolSchema = z.string().min(1).max(10).describe("Underlying stock ticker (e.g. 'AAPL', 'NYSE:GM')");
const expirationSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").describe("Expiration date (YYYY-MM-DD)");

export function createOptionsModule(apiToken: string): ModuleDefinition {
  const isSandbox = !process.env.TRADIER_BASE_URL;
  const metadata = { source: "tradier", dataDelay: isSandbox ? "15min (sandbox)" : "realtime" };

  const chainTool: ToolDefinition = {
    name: "options_chain",
    description:
      "Get the full options chain for a stock ticker and expiration date, " +
      "including Greeks (delta, gamma, theta, vega) and implied volatility. " +
      "Use options_expirations first to find valid expiration dates.",
    inputSchema: z.object({
      symbol: symbolSchema,
      expiration: expirationSchema,
      side: z.enum(["call", "put", "both"]).optional().describe("Filter by option type (default: both)"),
      min_open_interest: z.number().optional().describe("Minimum open interest filter (default: 0)"),
      limit: z.number().optional().describe("Max contracts to return (default: 50, max: 200)"),
    }),
    handler: withMetadata(async (params) => {
      const { ticker } = resolveTicker(params.symbol as string);
      let chain = await getOptionsChain(apiToken, ticker, params.expiration as string);

      if (params.side && params.side !== "both") {
        chain = chain.filter(c => c.optionType === params.side);
      }

      const minOI = (params.min_open_interest as number) ?? 0;
      if (minOI > 0) {
        chain = chain.filter(c => c.openInterest >= minOI);
      }

      const limit = Math.min((params.limit as number) ?? 50, 200);
      chain = chain.slice(0, limit);

      return successResult(JSON.stringify(chain, null, 2));
    }, metadata),
  };

  const expirationsTool: ToolDefinition = {
    name: "options_expirations",
    description:
      "List all available expiration dates for a stock's options. " +
      "Call this first before using options_chain to find valid dates.",
    inputSchema: z.object({
      symbol: symbolSchema,
    }),
    handler: withMetadata(async (params) => {
      const { ticker } = resolveTicker(params.symbol as string);
      const dates = await getExpirations(apiToken, ticker);
      return successResult(JSON.stringify(dates, null, 2));
    }, metadata),
  };

  const unusualActivityTool: ToolDefinition = {
    name: "options_unusual_activity",
    description:
      "Find options contracts with unusually high volume relative to open interest " +
      "(a common 'smart money' signal). Scans the nearest 2 expirations and flags " +
      "contracts where volume/OI exceeds a threshold.",
    inputSchema: z.object({
      symbol: symbolSchema,
      volume_oi_ratio: z.number().optional().describe("Min volume/OI ratio to flag as unusual (default: 3.0)"),
      min_volume: z.number().optional().describe("Min absolute volume (default: 100)"),
      side: z.enum(["call", "put", "both"]).optional().describe("Filter by option type (default: both)"),
    }),
    handler: withMetadata(async (params) => {
      const { ticker } = resolveTicker(params.symbol as string);
      const minRatio = (params.volume_oi_ratio as number) ?? 3.0;
      const minVol = (params.min_volume as number) ?? 100;
      const minOI = 10;

      const expirations = await getExpirations(apiToken, ticker);
      const nearestExps = expirations.slice(0, 2);

      if (nearestExps.length === 0) {
        return successResult(JSON.stringify({ symbol: ticker, unusual: [], message: "No options available" }));
      }

      const chainResults = await Promise.all(
        nearestExps.map(exp => getOptionsChain(apiToken, ticker, exp)),
      );
      const allContracts = chainResults.flat();

      let unusual = allContracts
        .filter(c => c.volume >= minVol && c.openInterest >= minOI)
        .map(c => ({
          ...c,
          volumeOiRatio: Math.round((c.volume / c.openInterest) * 100) / 100,
        }))
        .filter(c => c.volumeOiRatio >= minRatio);

      if (params.side && params.side !== "both") {
        unusual = unusual.filter(c => c.optionType === params.side);
      }

      unusual.sort((a, b) => b.volume - a.volume);
      unusual = unusual.slice(0, 20);

      return successResult(JSON.stringify({ symbol: ticker, unusual }, null, 2));
    }, metadata),
  };

  const maxPainTool: ToolDefinition = {
    name: "options_max_pain",
    description:
      "Calculate the max pain strike price for an expiration date. " +
      "Max pain is the strike where option writers' total payout is minimized " +
      "(the price where most options expire worthless). Useful for predicting " +
      "where market makers may pin the stock near expiration.",
    inputSchema: z.object({
      symbol: symbolSchema,
      expiration: expirationSchema,
    }),
    handler: withMetadata(async (params) => {
      const { ticker } = resolveTicker(params.symbol as string);
      const chain = await getOptionsChain(apiToken, ticker, params.expiration as string);
      const result = calculateMaxPain(chain);

      return successResult(JSON.stringify({
        symbol: ticker,
        expiration: params.expiration,
        maxPainStrike: result.maxPainStrike,
        painCurve: result.painCurve,
      }, null, 2));
    }, metadata),
  };

  return {
    name: "options",
    description: "Options chains with Greeks, unusual activity detection, and max pain calculator via Tradier API",
    requiredEnvVars: ["TRADIER_API_TOKEN"],
    tools: [chainTool, expirationsTool, unusualActivityTool, maxPainTool],
  };
}
