import { z } from "zod";
import type { ModuleDefinition } from "../../shared/types.js";
import { successResult } from "../../shared/types.js";
import {
  getLatestRates,
  getHistoricalRates,
  getTimeSeries,
  convertCurrency,
  getCurrencies,
} from "./client.js";
import { withMetadata } from "../../shared/utils.js";

const metadata = { source: "frankfurter", dataDelay: "end-of-day" };

const currencyCode = z
  .string()
  .min(3)
  .max(3)
  .describe("ISO 4217 currency code (e.g. 'USD', 'EUR', 'GBP', 'JPY')");

const latestTool = {
  name: "frankfurter_latest",
  description:
    "Get latest forex exchange rates from the European Central Bank. " +
    "Returns daily reference rates for 31 major currencies. " +
    "Updated once per business day at ~16:00 CET. " +
    "These are reference rates, not real-time trading rates.",
  inputSchema: z.object({
    base: currencyCode.default("USD").describe("Base currency (default: USD)"),
    symbols: z
      .string()
      .optional()
      .describe(
        "Comma-separated target currencies (e.g. 'EUR,GBP,JPY'). Omit for all 31.",
      ),
  }),
  handler: withMetadata(async (params) => {
    const result = await getLatestRates(
      params.base as string,
      params.symbols as string | undefined,
    );
    return successResult(JSON.stringify(result, null, 2));
  }, metadata),
};

const historicalTool = {
  name: "frankfurter_historical",
  description:
    "Get forex exchange rates for a specific past date. " +
    "If the date is a weekend or holiday, returns the previous business day's rates. " +
    "Data available from 1999-01-04 (Euro inception).",
  inputSchema: z.object({
    date: z.string().describe("Date in YYYY-MM-DD format"),
    base: currencyCode.default("USD").describe("Base currency (default: USD)"),
    symbols: z
      .string()
      .optional()
      .describe("Comma-separated target currencies. Omit for all."),
  }),
  handler: withMetadata(async (params) => {
    const result = await getHistoricalRates(
      params.base as string,
      params.date as string,
      params.symbols as string | undefined,
    );
    return successResult(JSON.stringify(result, null, 2));
  }, metadata),
};

const timeseriesTool = {
  name: "frankfurter_timeseries",
  description:
    "Get daily forex rate history for a date range (max 90 days). " +
    "Use for currency trend analysis. Only business days are included " +
    "(weekends/holidays omitted). Requires symbols filter to control response size.",
  inputSchema: z.object({
    start_date: z.string().describe("Start date (YYYY-MM-DD)"),
    end_date: z
      .string()
      .optional()
      .describe(
        "End date (YYYY-MM-DD, defaults to today, max 90 days from start)",
      ),
    base: currencyCode.default("USD").describe("Base currency (default: USD)"),
    symbols: z
      .string()
      .describe(
        "Required: comma-separated target currencies (e.g. 'EUR,GBP')",
      ),
  }),
  handler: withMetadata(async (params) => {
    const result = await getTimeSeries(
      params.base as string,
      params.symbols as string,
      params.start_date as string,
      params.end_date as string | undefined,
    );
    return successResult(JSON.stringify(result, null, 2));
  }, metadata),
};

const convertTool = {
  name: "frankfurter_convert",
  description:
    "Convert an amount between two currencies at the latest ECB reference rate. " +
    "Useful for cross-border stock valuation and currency exposure calculations.",
  inputSchema: z.object({
    amount: z.number().describe("Amount to convert"),
    from: currencyCode.describe("Source currency (e.g. 'USD')"),
    to: currencyCode.describe("Target currency (e.g. 'EUR')"),
  }),
  handler: withMetadata(async (params) => {
    const result = await convertCurrency(
      params.amount as number,
      params.from as string,
      params.to as string,
    );
    return successResult(JSON.stringify(result, null, 2));
  }, metadata),
};

const currenciesTool = {
  name: "frankfurter_currencies",
  description:
    "List all 31 currencies supported by the Frankfurter API with their full names. " +
    "Use to look up valid currency codes before calling other frankfurter tools.",
  inputSchema: z.object({}),
  handler: withMetadata(async () => {
    const result = await getCurrencies();
    return successResult(JSON.stringify(result, null, 2));
  }, metadata),
};

export function createFrankfurterModule(): ModuleDefinition {
  return {
    name: "frankfurter",
    description:
      "Forex exchange rates from ECB — daily reference rates for 31 currencies, no API key required",
    requiredEnvVars: [],
    tools: [
      latestTool,
      historicalTool,
      timeseriesTool,
      convertTool,
      currenciesTool,
    ],
  };
}
