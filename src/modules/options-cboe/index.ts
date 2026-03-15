import { z } from "zod";
import type { ModuleDefinition } from "../../shared/types.js";
import { successResult } from "../../shared/types.js";
import { getPutCallRatio } from "./cboe.js";
import { withMetadata } from "../../shared/utils.js";

export function createOptionsCboeModule(): ModuleDefinition {
  const metadata = { source: "cboe", dataDelay: "end-of-day" };
  return {
    name: "options-cboe",
    description: "CBOE market-wide put/call ratio data — daily sentiment indicator from options volume",
    requiredEnvVars: [],
    tools: [{
      name: "options_put_call_ratio",
      description: "Get historical put/call ratio from CBOE (market-wide sentiment indicator). Ratio > 1.0 = more puts (bearish sentiment), < 0.7 = more calls (bullish/complacent). Types: 'total' (all options), 'equity' (stock options only), 'index' (index options only).",
      inputSchema: z.object({
        type: z.enum(["total", "equity", "index"]).optional().describe("Ratio type (default: total)"),
        days: z.number().optional().describe("Number of recent trading days to return (default: 30, max: 252)"),
      }),
      handler: withMetadata(async (params) => {
        const days = Math.min(Math.max((params.days as number) ?? 30, 1), 252);
        const data = await getPutCallRatio((params.type as string) ?? "total", days);
        return successResult(JSON.stringify(data, null, 2));
      }, metadata),
    }],
  };
}
