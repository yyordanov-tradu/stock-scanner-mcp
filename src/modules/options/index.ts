import { z } from "zod";
import type { ModuleDefinition, ToolDefinition } from "../../shared/types.js";
import { successResult } from "../../shared/types.js";
import { fetchOptionChain } from "./client.js";
import { withMetadata } from "../../shared/utils.js";

const metadata = { source: "yahoo-finance", dataDelay: "15min" };

const symbolSchema = z.string().min(1).max(10)
  .describe("Stock ticker symbol (e.g. 'AAPL', 'NYSE:GM')");

function parseExpiration(value: string | undefined): number | undefined {
  if (!value) return undefined;
  // Accept YYYY-MM-DD → convert to Unix timestamp
  const ts = Math.floor(new Date(value + "T00:00:00Z").getTime() / 1000);
  if (isNaN(ts)) return undefined;
  return ts;
}

const expirationsTool: ToolDefinition = {
  name: "options_expirations",
  description:
    "Get all available option expiration dates for a stock ticker. " +
    "Call this first to discover valid dates, then pass one to options_chain or options_max_pain.",
  inputSchema: z.object({
    symbol: symbolSchema,
  }),
  handler: withMetadata(async (params) => {
    const chain = await fetchOptionChain(params.symbol as string);
    const dates = chain.expirationDates.map(
      d => new Date(d * 1000).toISOString().split("T")[0],
    );
    return successResult(JSON.stringify({
      symbol: chain.underlyingSymbol,
      underlyingPrice: chain.underlyingPrice,
      expirations: dates,
    }, null, 2));
  }, metadata),
};

const chainTool: ToolDefinition = {
  name: "options_chain",
  description:
    "Get the full option chain (calls and puts) with calculated Greeks (Delta, Gamma, Theta, Vega). " +
    "Use options_expirations first to find valid dates. If expiration is omitted, uses nearest date. " +
    "By default, returns strikes within ±20% of current price to save tokens. " +
    "Use strike_min/strike_max for custom range, or all_strikes=true for everything.",
  inputSchema: z.object({
    symbol: symbolSchema,
    expiration: z.string().optional()
      .describe("Expiration date as YYYY-MM-DD (e.g. '2026-04-17'). If omitted, uses nearest."),
    side: z.enum(["call", "put", "both"]).optional()
      .describe("Filter by option type (default: both)"),
    limit: z.number().optional()
      .describe("Max contracts per side (default: 50, max: 200)"),
    strike_min: z.number().optional()
      .describe("Minimum strike price filter (e.g. 25.0)"),
    strike_max: z.number().optional()
      .describe("Maximum strike price filter (e.g. 35.0)"),
    all_strikes: z.boolean().optional()
      .describe("Return all strikes instead of centering around ATM (default: false)"),
  }),
  handler: withMetadata(async (params) => {
    const expUnix = parseExpiration(params.expiration as string | undefined);
    const chain = await fetchOptionChain(params.symbol as string, expUnix);

    let { calls, puts } = chain;

    // Determine strike range: explicit min/max > default ±20% ATM > all
    const allStrikes = (params.all_strikes as boolean) ?? false;
    const hasExplicitRange = params.strike_min != null || params.strike_max != null;

    if (!allStrikes) {
      let minStrike: number;
      let maxStrike: number;

      if (hasExplicitRange) {
        minStrike = (params.strike_min as number) ?? 0;
        maxStrike = (params.strike_max as number) ?? Infinity;
      } else {
        // Default: ±20% of underlying price
        minStrike = chain.underlyingPrice * 0.8;
        maxStrike = chain.underlyingPrice * 1.2;
      }

      calls = calls.filter(c => c.strike >= minStrike && c.strike <= maxStrike);
      puts = puts.filter(c => c.strike >= minStrike && c.strike <= maxStrike);
    }

    if (params.side === "call") {
      puts = [];
    } else if (params.side === "put") {
      calls = [];
    }

    const limit = Math.min((params.limit as number) ?? 50, 200);
    calls = calls.slice(0, limit);
    puts = puts.slice(0, limit);

    return successResult(JSON.stringify({
      ...chain,
      calls,
      puts,
    }, null, 2));
  }, metadata),
};

const unusualActivityTool: ToolDefinition = {
  name: "options_unusual_activity",
  description:
    "Find options contracts with unusually high volume relative to open interest " +
    "(a common 'smart money' signal). Scans the nearest expiration and flags " +
    "contracts where volume/OI exceeds a threshold.",
  inputSchema: z.object({
    symbol: symbolSchema,
    volume_oi_ratio: z.number().optional()
      .describe("Min volume/OI ratio to flag as unusual (default: 3.0)"),
    min_volume: z.number().optional()
      .describe("Min absolute volume (default: 100)"),
    side: z.enum(["call", "put", "both"]).optional()
      .describe("Filter by option type (default: both)"),
  }),
  handler: withMetadata(async (params) => {
    const chain = await fetchOptionChain(params.symbol as string);
    const minRatio = (params.volume_oi_ratio as number) ?? 3.0;
    const minVol = (params.min_volume as number) ?? 100;
    const minOI = 10;

    const allContracts = [
      ...chain.calls.map(c => ({ ...c, side: "call" as const })),
      ...chain.puts.map(c => ({ ...c, side: "put" as const })),
    ];

    let unusual = allContracts
      .filter(c => c.volume >= minVol && c.openInterest >= minOI)
      .map(c => ({
        ...c,
        volumeOiRatio: Math.round((c.volume / c.openInterest) * 100) / 100,
      }))
      .filter(c => c.volumeOiRatio >= minRatio);

    if (params.side && params.side !== "both") {
      unusual = unusual.filter(c => c.side === params.side);
    }

    unusual.sort((a, b) => b.volume - a.volume);
    unusual = unusual.slice(0, 20);

    return successResult(JSON.stringify({
      symbol: chain.underlyingSymbol,
      underlyingPrice: chain.underlyingPrice,
      unusual,
    }, null, 2));
  }, metadata),
};

const maxPainTool: ToolDefinition = {
  name: "options_max_pain",
  description:
    "Calculate the max pain strike price — where cumulative option open interest expires worthless. " +
    "This level often acts as a support/resistance zone near expiration.",
  inputSchema: z.object({
    symbol: symbolSchema,
    expiration: z.string().optional()
      .describe("Expiration date as YYYY-MM-DD. If omitted, uses nearest."),
  }),
  handler: withMetadata(async (params) => {
    const expUnix = parseExpiration(params.expiration as string | undefined);
    const chain = await fetchOptionChain(params.symbol as string, expUnix);
    const expDate = chain.expirationDates[0]
      ? new Date(chain.expirationDates[0] * 1000).toISOString().split("T")[0]
      : "unknown";

    return successResult(JSON.stringify({
      symbol: chain.underlyingSymbol,
      underlyingPrice: chain.underlyingPrice,
      expiration: expDate,
      maxPain: chain.maxPain,
    }, null, 2));
  }, metadata),
};

const impliedMoveTool: ToolDefinition = {
  name: "options_implied_move",
  description:
    "Calculate the expected move implied by options pricing (ATM straddle). " +
    "Essential for earnings plays — shows how much the market expects the stock to move. " +
    "Compare implied vs historical moves to assess if premium is cheap or expensive.",
  inputSchema: z.object({
    symbol: symbolSchema,
    expiration: z.string().optional()
      .describe("Expiration date as YYYY-MM-DD. If omitted, uses nearest."),
  }),
  handler: withMetadata(async (params) => {
    const expUnix = parseExpiration(params.expiration as string | undefined);
    const chain = await fetchOptionChain(params.symbol as string, expUnix);
    const price = chain.underlyingPrice;
    const expDate = chain.expirationDates[0]
      ? new Date(chain.expirationDates[0] * 1000).toISOString().split("T")[0]
      : "unknown";

    // Find ATM call and put (closest strikes to underlying price)
    const atmCall = chain.calls.reduce((best, c) =>
      Math.abs(c.strike - price) < Math.abs(best.strike - price) ? c : best,
      chain.calls[0],
    );
    const atmPut = chain.puts.reduce((best, p) =>
      Math.abs(p.strike - price) < Math.abs(best.strike - price) ? p : best,
      chain.puts[0],
    );

    if (!atmCall || !atmPut) {
      return successResult(JSON.stringify({
        symbol: chain.underlyingSymbol,
        underlyingPrice: price,
        error: "Insufficient options data to calculate implied move",
      }, null, 2));
    }

    // ATM straddle price = ATM call last + ATM put last
    const callPrice = atmCall.lastPrice || ((atmCall.bid + atmCall.ask) / 2) || 0;
    const putPrice = atmPut.lastPrice || ((atmPut.bid + atmPut.ask) / 2) || 0;
    const straddlePrice = callPrice + putPrice;
    const impliedMoveAbs = straddlePrice;
    const impliedMovePct = price > 0 ? (straddlePrice / price) * 100 : 0;

    // Average IV from ATM options
    const avgIv = ((atmCall.impliedVolatility || 0) + (atmPut.impliedVolatility || 0)) / 2;

    return successResult(JSON.stringify({
      symbol: chain.underlyingSymbol,
      underlyingPrice: price,
      expiration: expDate,
      atmCallStrike: atmCall.strike,
      atmCallPrice: callPrice,
      atmPutStrike: atmPut.strike,
      atmPutPrice: putPrice,
      straddlePrice,
      impliedMove: Math.round(impliedMovePct * 100) / 100,
      impliedMoveAbsolute: Math.round(impliedMoveAbs * 100) / 100,
      impliedVolatility: Math.round(avgIv * 10000) / 100,
      expectedRange: {
        low: Math.round((price - impliedMoveAbs) * 100) / 100,
        high: Math.round((price + impliedMoveAbs) * 100) / 100,
      },
    }, null, 2));
  }, metadata),
};

export function createOptionsModule(): ModuleDefinition {
  return {
    name: "options",
    description: "Stock options chains, Greeks, unusual activity, implied move, and max pain from Yahoo Finance (no API key required)",
    requiredEnvVars: [],
    tools: [expirationsTool, chainTool, unusualActivityTool, maxPainTool, impliedMoveTool],
  };
}
