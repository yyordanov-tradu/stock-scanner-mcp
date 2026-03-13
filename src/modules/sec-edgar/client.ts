import { httpGet } from "../../shared/http.js";
import { TtlCache } from "../../shared/cache.js";

const EFTS_BASE = "https://efts.sec.gov/LATEST/search-index";
const USER_AGENT =
  "StockScanner contact@example.com";
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
    headers: { "User-Agent": USER_AGENT },
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
