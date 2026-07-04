import { z } from "zod";
import type { ModuleDefinition } from "../../shared/types.js";
import { successResult } from "../../shared/types.js";
import { getMarketBreadth } from "./client.js";
import { withMetadata } from "../../shared/utils.js";

export function createMarketBreadthModule(): ModuleDefinition {
  const metadata = { source: "tradingview", dataDelay: "15min" };

  return {
    name: "market-breadth",
    description: "Market breadth metrics aggregating advance/decline ratios, SMA alignment, and new 52-week highs/lows.",
    requiredEnvVars: [],
    tools: [
      {
        name: "market_breadth",
        description: "Get market breadth statistics for US equities (NYSE, NASDAQ, AMEX). Recommends default 'major_us' representing NYSE+NASDAQ+AMEX. Filters out ETFs, funds, and illiquid symbols (volume < 10k) by default to measure standard stock performance.",
        inputSchema: z.object({
          universe: z.enum(["major_us", "both", "NYSE", "NASDAQ", "AMEX"]).default("major_us")
            .describe("Stock exchange universe. major_us includes NYSE, NASDAQ, and AMEX. both includes NYSE and NASDAQ. NYSE, NASDAQ, or AMEX queries single exchange."),
          limit: z.number().int().min(100).max(10000).default(3000)
            .describe("Max stocks to scan per exchange (default 3000)."),
          newHighLowThresholdPct: z.number().min(0).max(5).default(0.5)
            .describe("Proximity threshold to count new 52-week high or low (e.g. 0.5 means within 0.5% of high/low, default 0.5)."),
        }),
        readOnly: true,
        handler: withMetadata(async (input) => {
          const result = await getMarketBreadth({
            universe: input.universe as any,
            limit: input.limit,
            newHighLowThresholdPct: input.newHighLowThresholdPct,
          });
          return successResult(JSON.stringify(result, null, 2));
        }, metadata),
      },
    ],
  };
}
