import { httpGet } from "../../shared/http.js";
import { TtlCache } from "../../shared/cache.js";
import { SEC_USER_AGENT } from "../../shared/types.js";
import { getCikForTicker } from "./cik-mapper.js";

const EFTS_BASE = "https://efts.sec.gov/LATEST/search-index";
const DATA_BASE = "https://data.sec.gov/api/xbrl/companyfacts";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const cache = new TtlCache<unknown>(CACHE_TTL);

export interface EdgarSearchParams {
  query: string;
  dateRange?: string;
  forms?: string[];
  tickers?: string[];
  limit?: number;
}

export interface EdgarFiling {
  accessionNumber: string;
  filedAt: string;
  formType: string;
  entityName: string;
  ticker: string;
  description: string;
  documentUrl: string;
}

export async function searchFilings(
  params: EdgarSearchParams,
): Promise<EdgarFiling[]> {
  const searchParams = new URLSearchParams();
  searchParams.set("q", params.query);
  if (params.dateRange) searchParams.set("dateRange", params.dateRange);
  if (params.forms?.length)
    searchParams.set("forms", params.forms.join(","));
  if (params.tickers?.length)
    searchParams.set("tickers", params.tickers.join(","));
  searchParams.set("from", "0");
  searchParams.set("size", String(params.limit ?? 20));

  const url = `${EFTS_BASE}?${searchParams.toString()}`;

  const cached = cache.get(url);
  if (cached) return cached as EdgarFiling[];

  const response = await httpGet<{
    hits: {
      hits: Array<{
        _id: string;
        _source: {
          file_num: string;
          file_date: string;
          form_type: string;
          entity_name: string;
          tickers: string;
          display_names: string[];
          file_description: string;
        };
      }>;
    };
  }>(url, {
    headers: { "User-Agent": SEC_USER_AGENT },
  });

  const filings: EdgarFiling[] = response.hits.hits.map((hit) => {
    const cik = hit._id.replace(/-/g, "").slice(0, 10);
    return {
      accessionNumber: hit._id,
      filedAt: hit._source.file_date,
      formType: hit._source.form_type,
      entityName: hit._source.entity_name,
      ticker: hit._source.tickers ?? "",
      description: hit._source.file_description ?? "",
      documentUrl: `https://www.sec.gov/Archives/edgar/data/${cik}/${hit._id}.txt`,
    };
  });

  cache.set(url, filings);
  return filings;
}

export interface CompanyFilingsParams {
  ticker: string;
  forms?: string[];
  limit?: number;
}

export async function getCompanyFilings(
  params: CompanyFilingsParams,
): Promise<EdgarFiling[]> {
  return searchFilings({
    query: params.ticker,
    forms: params.forms,
    limit: params.limit,
  });
}

export interface CompanyMetricValue {
  val: number;
  accn: string;
  fy: number;
  fp: string;
  form: string;
  filed: string;
  frame?: string;
  end: string;
}

export interface CompanyFacts {
  ticker: string;
  cik: string;
  entityName: string;
  metrics: Record<string, CompanyMetricValue>;
}

interface SecFactsResponse {
  cik: number;
  entityName: string;
  facts: {
    "us-gaap"?: Record<string, {
      units: Record<string, CompanyMetricValue[]>;
    }>;
  };
}

/**
 * Get summarized financial facts for a company using the SEC XBRL API.
 */
export async function getCompanyFacts(ticker: string): Promise<CompanyFacts> {
  const cik = await getCikForTicker(ticker);
  if (!cik) throw new Error(`Could not find CIK for ticker ${ticker}`);

  const cacheKey = `facts-summary:${cik}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as CompanyFacts;

  const url = `${DATA_BASE}/CIK${cik}.json`;
  const data = await httpGet<SecFactsResponse>(url, {
    headers: { "User-Agent": SEC_USER_AGENT },
  });

  const usGaap = data.facts["us-gaap"] || {};
  const keyMetricsMap: Record<string, string[]> = {
    Revenue: ["SalesRevenueNet", "Revenues", "TotalRevenues"],
    NetIncome: ["NetIncomeLoss", "NetIncomeLossAvailableToCommonStockholdersBasic"],
    Assets: ["Assets"],
    Liabilities: ["Liabilities"],
    EPS: ["EarningsPerShareBasic", "EarningsPerShareDiluted"],
    Cash: ["CashAndCashEquivalentsAtCarryingValue"],
  };

  const summarizedMetrics: Record<string, CompanyMetricValue> = {};

  for (const [label, names] of Object.entries(keyMetricsMap)) {
    for (const name of names) {
      if (usGaap[name]) {
        const units = usGaap[name].units;
        const unitKey = Object.keys(units)[0];
        const values = [...units[unitKey]];
        // Sort by end date to get the absolute latest
        values.sort((a, b) => b.end.localeCompare(a.end));
        summarizedMetrics[label] = values[0];
        break; // Found one for this label
      }
    }
  }

  const result: CompanyFacts = {
    ticker: ticker.toUpperCase(),
    cik,
    entityName: data.entityName,
    metrics: summarizedMetrics,
  };

  cache.set(cacheKey, result);
  return result;
}

/**
 * Get recent insider trades (Forms 3, 4, 5) for a ticker.
 */
export async function getInsiderTrades(ticker: string, limit = 10): Promise<EdgarFiling[]> {
  return searchFilings({
    query: ticker,
    forms: ["3", "3/A", "4", "4/A", "5", "5/A"],
    limit,
  });
}

/**
 * Get recent institutional holdings reports (Form 13F) for a ticker or manager.
 */
export async function getInstitutionalHoldings(query: string, limit = 10): Promise<EdgarFiling[]> {
  return searchFilings({
    query,
    forms: ["13F-HR", "13F-HR/A", "13F-NT", "13F-NT/A"],
    limit,
  });
}

/**
 * Get recent significant ownership filings (13D, 13G) for a ticker.
 */
export async function getOwnershipFilings(ticker: string, limit = 10): Promise<EdgarFiling[]> {
  return searchFilings({
    query: ticker,
    forms: ["SC 13D", "SC 13D/A", "SC 13G", "SC 13G/A"],
    limit,
  });
}
