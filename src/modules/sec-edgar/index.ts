import { z } from "zod";
import type { ModuleDefinition, ToolDefinition } from "../../shared/types.js";
import { successResult, errorResult } from "../../shared/types.js";
import {
  searchFilings,
  getCompanyFilings,
  getCompanyFacts,
  getInsiderTrades,
  getInstitutionalHoldings,
  getOwnershipFilings,
} from "./client.js";

const searchTool: ToolDefinition = {
  name: "edgar_search",
  description:
    "Search SEC EDGAR filings by keyword. Best for finding mentions of specific trends, technologies, or events across all companies. Returns metadata including accession numbers, form types, and direct sec.gov links.",
  inputSchema: {
    query: z
      .string()
      .describe(
        "Keyword or phrase to search for (e.g. 'lithium mining', 'share repurchase program')",
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
    "Retrieve the most recent official filings for a specific company. Use this to find a company's latest 10-K (annual), 10-Q (quarterly), or 8-K (current events) reports.",
  inputSchema: {
    ticker: z.string().describe("Stock ticker symbol (e.g. 'AAPL')"),
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

const companyFactsTool: ToolDefinition = {
  name: "edgar_company_facts",
  description:
    "Retrieve high-fidelity financial metrics (Revenue, Net Income, EPS, Assets, Liabilities) directly from SEC XBRL data. This is more reliable than extracting numbers from text filings.",
  inputSchema: {
    ticker: z.string().describe("Stock ticker symbol (e.g. 'AAPL')"),
  },
  handler: async (params) => {
    try {
      const facts = await getCompanyFacts(params.ticker as string);
      return successResult(JSON.stringify(facts, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

const insiderTradesTool: ToolDefinition = {
  name: "edgar_insider_trades",
  description: "Monitor legal stock trades made by company executives and directors (Forms 3, 4, 5). Large buys or sales by insiders are key indicators of internal sentiment.",
  inputSchema: {
    ticker: z.string().describe("Stock ticker symbol (e.g. 'AAPL')"),
    limit: z.number().optional().describe("Max results (default: 10)"),
  },
  handler: async (params) => {
    try {
      const trades = await getInsiderTrades(
        params.ticker as string,
        params.limit as number | undefined,
      );
      return successResult(JSON.stringify(trades, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

const institutionalHoldingsTool: ToolDefinition = {
  name: "edgar_institutional_holdings",
  description:
    "Track 'big money' moves by searching Form 13F filings. Use to find what hedge funds and institutional managers (e.g. 'Berkshire Hathaway') are holding or what firms own a specific ticker.",
  inputSchema: {
    query: z
      .string()
      .describe("Stock ticker (e.g. 'AAPL') or institutional manager name (e.g. 'Berkshire Hathaway')"),
    limit: z.number().optional().describe("Max results (default: 10)"),
  },
  handler: async (params) => {
    try {
      const holdings = await getInstitutionalHoldings(
        params.query as string,
        params.limit as number | undefined,
      );
      return successResult(JSON.stringify(holdings, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

const ownershipFilingsTool: ToolDefinition = {
  name: "edgar_ownership_filings",
  description:
    "Monitor significant changes in company ownership (5%+ stakes). Use 13D and 13G filings to identify activist investors (e.g. Carl Icahn, Ryan Cohen) entering or exiting a stock.",
  inputSchema: {
    ticker: z.string().describe("Stock ticker symbol (e.g. 'AAPL')"),
    limit: z.number().optional().describe("Max results (default: 10)"),
  },
  handler: async (params) => {
    try {
      const filings = await getOwnershipFilings(
        params.ticker as string,
        params.limit as number | undefined,
      );
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
    tools: [
      searchTool,
      companyFilingsTool,
      companyFactsTool,
      insiderTradesTool,
      institutionalHoldingsTool,
      ownershipFilingsTool,
    ],
  };
}
