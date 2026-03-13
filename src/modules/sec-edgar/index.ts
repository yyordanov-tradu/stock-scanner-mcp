import { z } from "zod";
import type { ModuleDefinition, ToolDefinition } from "../../shared/types.js";
import { successResult, errorResult } from "../../shared/types.js";
import { searchFilings, getCompanyFilings } from "./client.js";

const searchTool: ToolDefinition = {
  name: "edgar_search",
  description:
    "Search SEC EDGAR filings by keyword. Returns accession numbers, filing dates, form types, and entity names. Rate limit: 10 requests/second.",
  inputSchema: {
    query: z
      .string()
      .describe(
        "Search query (e.g. 'artificial intelligence', 'revenue growth')",
      ),
    dateRange: z
      .string()
      .optional()
      .describe("Date range as 'YYYY-MM-DD,YYYY-MM-DD'"),
    forms: z
      .array(z.string())
      .optional()
      .describe("Form types to filter (e.g. ['10-K', '10-Q', '8-K'])"),
    tickers: z
      .array(z.string())
      .optional()
      .describe("Company tickers to filter (e.g. ['AAPL', 'MSFT'])"),
    limit: z
      .number()
      .optional()
      .describe("Max results (default: 20, max: 50)"),
  },
  handler: async (params) => {
    try {
      const filings = await searchFilings({
        query: params.query as string,
        dateRange: params.dateRange as string | undefined,
        forms: params.forms as string[] | undefined,
        tickers: params.tickers as string[] | undefined,
        limit: Math.min((params.limit as number) ?? 20, 50),
      });
      return successResult(JSON.stringify(filings, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

const companyFilingsTool: ToolDefinition = {
  name: "edgar_company_filings",
  description:
    "Get recent SEC filings for a specific company by ticker symbol.",
  inputSchema: {
    ticker: z.string().describe("Company ticker symbol (e.g. 'AAPL')"),
    forms: z
      .array(z.string())
      .optional()
      .describe("Form types (e.g. ['10-K', '10-Q']). Default: all."),
    limit: z
      .number()
      .optional()
      .describe("Max results (default: 10, max: 50)"),
  },
  handler: async (params) => {
    try {
      const filings = await getCompanyFilings({
        ticker: params.ticker as string,
        forms: params.forms as string[] | undefined,
        limit: Math.min((params.limit as number) ?? 10, 50),
      });
      return successResult(JSON.stringify(filings, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

export function createSecEdgarModule(): ModuleDefinition {
  return {
    name: "sec-edgar",
    description:
      "SEC EDGAR filing search -- full-text search and company filing lookup via EFTS",
    requiredEnvVars: [],
    tools: [searchTool, companyFilingsTool],
  };
}
