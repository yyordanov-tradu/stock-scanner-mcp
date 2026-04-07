import { z } from "zod";
import type { ModuleDefinition, ToolDefinition } from "../../shared/types.js";
import { successResult } from "../../shared/types.js";
import { withMetadata } from "../../shared/utils.js";
import {
  getEconomicCalendar,
  getIndicator,
  getIndicatorHistory,
  searchSeries,
} from "./client.js";

export function createFredModule(apiKey: string): ModuleDefinition {
  const metadata = { source: "fred", dataDelay: "varies by indicator" };

  const calendarTool: ToolDefinition = {
    name: "fred_economic_calendar",
    description:
      "Get upcoming US economic release dates (FOMC, CPI, PPI, NFP, GDP, PCE, " +
      "jobless claims, retail sales, ISM, treasury rates). " +
      "Filters to high-impact releases only. " +
      "Use this to identify macro catalysts that could move markets. " +
      "Rate limit: 120 calls/min (free tier).",
    inputSchema: z.object({
      limit: z
        .number()
        .optional()
        .default(60)
        .describe("Max raw results to fetch before filtering (default: 60)"),
    }),
    readOnly: true,
    handler: withMetadata(async (params) => {
      const releases = await getEconomicCalendar(apiKey, params.limit as number);
      return successResult(JSON.stringify(releases, null, 2));
    }, metadata),
  };

  const indicatorTool: ToolDefinition = {
    name: "fred_indicator",
    description:
      "Get the latest value of a US economic indicator from FRED. " +
      "Accepts FRED series IDs (e.g. 'CPIAUCSL', 'DFF', 'UNRATE') or common aliases: " +
      "cpi, core_cpi, ppi, gdp, unemployment, nonfarm_payrolls, fed_funds, " +
      "treasury_10y, treasury_2y, initial_claims, core_pce. " +
      "Returns the indicator metadata (title, frequency, units) and latest observation. " +
      "Rate limit: 120 calls/min (free tier).",
    inputSchema: z.object({
      series_id: z
        .string()
        .describe("FRED series ID or alias (e.g. 'cpi', 'UNRATE', 'treasury_10y')"),
    }),
    readOnly: true,
    handler: withMetadata(async (params) => {
      const result = await getIndicator(apiKey, params.series_id as string);
      return successResult(JSON.stringify(result, null, 2));
    }, metadata),
  };

  const historyTool: ToolDefinition = {
    name: "fred_indicator_history",
    description:
      "Get historical values for a US economic indicator from FRED. " +
      "Accepts same series IDs/aliases as fred_indicator. " +
      "Supports units transformation: 'lin' (raw level), 'chg' (change), " +
      "'pc1' (% change from year ago — useful for YoY inflation), " +
      "'pch' (% change from prior period). " +
      "Use 'pc1' with CPI/PPI to get YoY inflation rates directly. " +
      "Rate limit: 120 calls/min (free tier).",
    inputSchema: z.object({
      series_id: z.string().describe("FRED series ID or alias"),
      start_date: z.string().describe("Start date YYYY-MM-DD"),
      end_date: z.string().describe("End date YYYY-MM-DD"),
      units: z
        .enum(["lin", "chg", "ch1", "pch", "pc1", "pca"])
        .optional()
        .default("lin")
        .describe("Units: lin=level, pch=% change, pc1=YoY % change (default: lin)"),
    }),
    readOnly: true,
    handler: withMetadata(async (params) => {
      const result = await getIndicatorHistory(
        apiKey,
        params.series_id as string,
        params.start_date as string,
        params.end_date as string,
        params.units as string,
      );
      return successResult(JSON.stringify(result, null, 2));
    }, metadata),
  };

  const searchTool: ToolDefinition = {
    name: "fred_search",
    description:
      "Search FRED for economic data series by keyword. " +
      "Returns series IDs that can be used with fred_indicator and fred_indicator_history. " +
      "Results sorted by relevance. Use to discover series IDs for niche indicators. " +
      "Rate limit: 120 calls/min (free tier).",
    inputSchema: z.object({
      query: z.string().describe("Search keywords (e.g. 'consumer price index', 'housing starts')"),
      limit: z.number().optional().default(10).describe("Max results (default: 10, max: 50)"),
    }),
    readOnly: true,
    handler: withMetadata(async (params) => {
      const results = await searchSeries(apiKey, params.query as string, params.limit as number);
      return successResult(JSON.stringify(results, null, 2));
    }, metadata),
  };

  return {
    name: "fred",
    description: "FRED economic data: calendar, indicators, interest rates, inflation",
    requiredEnvVars: ["FRED_API_KEY"],
    tools: [calendarTool, indicatorTool, historyTool, searchTool],
  };
}
