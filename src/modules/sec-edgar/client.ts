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

export interface InsiderTransaction {
  reporter: string;
  title: string;
  date: string;
  security: string;
  type: "BUY" | "SELL" | "OPTION_EXERCISE" | "GRANT" | "TAX_WITHHOLDING" | "OTHER";
  shares: number;
  price: number;
}

export interface EdgarFiling {
  accessionNumber: string;
  filedAt: string;
  formType: string;
  entityName: string;
  ticker: string;
  description: string;
  documentUrl: string;
  parsedTransactions?: InsiderTransaction[];
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

  // EFTS results aren't guaranteed sorted by date
  filings.sort((a, b) => b.filedAt.localeCompare(a.filedAt));

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

interface SecSubmissionsResponse {
  cik: string;
  name: string;
  filings: {
    recent: {
      accessionNumber: string[];
      filingDate: string[];
      form: string[];
      primaryDocument: string[];
      primaryDocDescription: string[];
    };
  };
}

function mapTransactionCode(code: string): InsiderTransaction["type"] {
  switch (code) {
    case "P": return "BUY";
    case "S": return "SELL";
    case "M": return "OPTION_EXERCISE";
    case "A": return "GRANT";
    case "F": return "TAX_WITHHOLDING";
    default: return "OTHER";
  }
}

async function parseForm4Filing(filing: EdgarFiling): Promise<InsiderTransaction[]> {
  try {
    const docContent = await httpGet<string>(filing.documentUrl, {
      headers: { "User-Agent": SEC_USER_AGENT },
      responseType: "text",
    });

    if (!docContent.includes("<ownershipDocument")) return [];

    const reporter = docContent.match(/<rptOwnerName>([^<]+)<\/rptOwnerName>/)?.[1] ?? "Unknown";
    const title = docContent.match(/<rptOwnerOfficerTitle>([^<]+)<\/rptOwnerOfficerTitle>/)?.[1] ?? "N/A";

    const transactions: InsiderTransaction[] = [];
    
    // Non-derivative and Derivative transactions
    const transRegex = /<(non)?DerivativeTransaction>([\s\S]*?)<\/(non)?DerivativeTransaction>/g;
    let match;
    while ((match = transRegex.exec(docContent)) !== null) {
      const trans = match[2];
      const security = trans.match(/<securityTitle>\s*<value>([^<]+)<\/value>/)?.[1] ?? "Unknown";
      const transDate = trans.match(/<transactionDate>\s*<value>([^<]+)<\/value>/)?.[1] ?? filing.filedAt;
      const transCode = trans.match(/<transactionCode>([^<]+)<\/transactionCode>/)?.[1] ?? 
                        trans.match(/<transactionAcquiredDisposedCode>\s*<value>([^<]+)<\/value>/)?.[1] ?? "";
      const shares = trans.match(/<transactionShares>\s*<value>([^<]+)<\/value>/)?.[1];
      const price = trans.match(/<transactionPricePerShare>\s*<value>([^<]+)<\/value>/)?.[1];

      transactions.push({
        reporter,
        title,
        date: transDate,
        security,
        type: mapTransactionCode(transCode),
        shares: shares ? parseFloat(shares) : 0,
        price: price ? parseFloat(price) : 0,
      });
    }

    if (transactions.length === 0) {
      console.error(`Warning: No transactions parsed for Form 4 ${filing.accessionNumber}`);
    }

    return transactions;
  } catch (err) {
    console.error(`Failed to parse Form 4 ${filing.accessionNumber}:`, err);
    return [];
  }
}

/**
 * Get recent insider trades (Forms 3, 4, 5) for a ticker.
 */
export async function getInsiderTrades(ticker: string, limit = 10): Promise<EdgarFiling[]> {
  const cik = await getCikForTicker(ticker);
  if (!cik) throw new Error(`Could not find CIK for ticker ${ticker}`);

  const cacheKey = `insider-trades-v2:${cik}:${limit}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as EdgarFiling[];

  const url = `https://data.sec.gov/submissions/CIK${cik}.json`;
  const data = await httpGet<SecSubmissionsResponse>(url, {
    headers: { "User-Agent": SEC_USER_AGENT },
  });

  const filings: EdgarFiling[] = [];
  const recent = data.filings.recent;
  const count = recent.form.length;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffStr = thirtyDaysAgo.toISOString().split("T")[0];

  for (let i = 0; i < count && filings.length < limit; i++) {
    const form = recent.form[i];
    const filingDate = recent.filingDate[i];

    // Enforce 30-day window for insider trades to keep data relevant
    if (filingDate < cutoffStr && filings.length > 0) break;

    if (form === "3" || form === "4" || form === "5") {
      const accession = recent.accessionNumber[i];
      const primaryDoc = recent.primaryDocument[i];
      const accNoDashes = accession.replace(/-/g, "");
      const rawDoc = primaryDoc.replace(/^xsl[^/]+\//, "");
      const docUrl = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accNoDashes}/${rawDoc}`;

      filings.push({
        accessionNumber: accession,
        filedAt: filingDate,
        formType: form,
        entityName: data.name,
        ticker: ticker.toUpperCase(),
        description: recent.primaryDocDescription[i] || "",
        documentUrl: docUrl,
      });
    }
  }

  // Parallel parse Form 4s
  const form4s = filings.filter(f => f.formType === "4");
  const results = await Promise.allSettled(form4s.map(f => parseForm4Filing(f)));
  
  let form4Idx = 0;
  for (let i = 0; i < filings.length; i++) {
    if (filings[i].formType === "4") {
      const result = results[form4Idx++];
      if (result.status === "fulfilled") {
        filings[i].parsedTransactions = result.value;
      }
    }
  }

  cache.set(cacheKey, filings);
  return filings;
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
