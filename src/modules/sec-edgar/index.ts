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

const companyFactsTool: ToolDefinition = {
  name: "edgar_company_facts",
  description:
    "Get key financial metrics (Revenue, Net Income, Assets, etc.) directly from SEC XBRL data.",
  inputSchema: {
    ticker: z.string().describe("Company ticker symbol (e.g. 'AAPL')"),
  },
  handler: async (params) => {
    try {
      const facts = await getCompanyFacts(params.ticker as string);
      // Summarize to most useful metrics to avoid output bloat
      const summary: Record<string, any> = {
        entityName: facts.entityName,
        cik: facts.cik,
        ticker: facts.ticker,
        metrics: {} as Record<string, any>,
      };

      const usGaap = facts.facts["us-gaap"] || {};
      const keyMetrics: Record<string, string[]> = {
        Revenue: ["SalesRevenueNet", "Revenues", "TotalRevenues"],
        NetIncome: ["NetIncomeLoss", "NetIncomeLossAvailableToCommonStockholdersBasic"],
        Assets: ["Assets"],
        Liabilities: ["Liabilities"],
        EPS: ["EarningsPerShareBasic", "EarningsPerShareDiluted"],
        Cash: ["CashAndCashEquivalentsAtCarryingValue"],
      };

      for (const [label, names] of Object.entries(keyMetrics)) {
        for (const name of names) {
          if (usGaap[name]) {
            const units = usGaap[name].units;
            const unitKey = Object.keys(units)[0];
            const values = [...units[unitKey]];
            // Sort by end date to get the absolute latest
            values.sort((a: any, b: any) => b.end.localeCompare(a.end));
            summary.metrics[label] = values[0];
            break; // Found one for this label
          }
        }
      }

      return successResult(JSON.stringify(summary, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

const insiderTradesTool: ToolDefinition = {
  name: "edgar_insider_trades",
  description: "Get recent insider trades (Forms 3, 4, 5) for a company.",
  inputSchema: {
    ticker: z.string().describe("Company ticker symbol (e.g. 'AAPL')"),
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
    "Get recent 13F filings (institutional manager holdings) for a ticker or manager name.",
  inputSchema: {
    query: z
      .string()
      .describe("Ticker (e.g. 'AAPL') or manager name (e.g. 'Berkshire Hathaway')"),
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
    "Get recent significant ownership filings (13D, 13G) for a company.",
  inputSchema: {
    ticker: z.string().describe("Company ticker symbol (e.g. 'AAPL')"),
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
