import { httpGet } from "../../shared/http.js";
import { TtlCache } from "../../shared/cache.js";

const BASE_URL = "https://www.alphavantage.co/query";
const CACHE_TTL = 60 * 1000; // 1 minute

const cache = new TtlCache<unknown>(CACHE_TTL);

function checkAvResponse(data: any) {
  if (!data) {
    throw new Error("Alpha Vantage API returned empty response");
  }
  if (data["Note"]) {
    throw new Error(`Alpha Vantage Rate Limit: ${data["Note"]}`);
  }
  if (data["Information"]) {
    throw new Error(`Alpha Vantage Info: ${data["Information"]}`);
  }
  if (data["Error Message"]) {
    throw new Error(`Alpha Vantage Error: ${data["Error Message"]}`);
  }
}

export interface StockQuote {
  symbol: string;
  open: number;
  high: number;
  low: number;
  price: number;
  volume: number;
  latestTradingDay: string;
  previousClose: number;
  change: number;
  changePercent: string;
}

export async function getQuote(apiKey: string, symbol: string): Promise<StockQuote> {
  const cacheKey = `quote:${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as StockQuote;

  const data = await httpGet<{
    "Global Quote": {
      "01. symbol": string;
      "02. open": string;
      "03. high": string;
      "04. low": string;
      "05. price": string;
      "06. volume": string;
      "07. latest trading day": string;
      "08. previous close": string;
      "09. change": string;
      "10. change percent": string;
    };
  }>(`${BASE_URL}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`);

  checkAvResponse(data);
  const gq = data["Global Quote"];
  if (!gq || !gq["01. symbol"]) {
    throw new Error(`Stock quote not found for ${symbol}`);
  }

  const quote: StockQuote = {
    symbol: gq["01. symbol"],
    open: parseFloat(gq["02. open"]),
    high: parseFloat(gq["03. high"]),
    low: parseFloat(gq["04. low"]),
    price: parseFloat(gq["05. price"]),
    volume: parseInt(gq["06. volume"], 10),
    latestTradingDay: gq["07. latest trading day"],
    previousClose: parseFloat(gq["08. previous close"]),
    change: parseFloat(gq["09. change"]),
    changePercent: gq["10. change percent"],
  };

  cache.set(cacheKey, quote);
  return quote;
}

export interface DailyPrice {
  date: string;
  open: number; high: number; low: number; close: number;
  volume: number;
}

export async function getDailyPrices(apiKey: string, symbol: string, limit: number = 30): Promise<DailyPrice[]> {
  const cacheKey = `daily:${symbol}:${limit}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as DailyPrice[];

  const data = await httpGet<{
    "Time Series (Daily)": Record<string, {
      "1. open": string;
      "2. high": string;
      "3. low": string;
      "4. close": string;
      "5. volume": string;
    }>;
  }>(`${BASE_URL}?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&outputsize=compact&apikey=${apiKey}`);

  checkAvResponse(data);
  const timeSeries = data["Time Series (Daily)"];
  if (!timeSeries) {
    throw new Error(`Daily prices not found for ${symbol}`);
  }

  const prices: DailyPrice[] = Object.entries(timeSeries)
    .slice(0, limit)
    .map(([date, values]) => ({
      date,
      open: parseFloat(values["1. open"]),
      high: parseFloat(values["2. high"]),
      low: parseFloat(values["3. low"]),
      close: parseFloat(values["4. close"]),
      volume: parseInt(values["5. volume"], 10),
    }));

  cache.set(cacheKey, prices);
  return prices;
}

export interface CompanyOverview {
  symbol: string;
  name: string;
  description: string;
  exchange: string;
  sector: string;
  industry: string;
  marketCap: number;
  peRatio: number;
  pegRatio: number;
  bookValue: number;
  dividendYield: number;
  eps: number;
  revenuePerShare: number;
  profitMargin: number;
  week52High: number;
  week52Low: number;
  analystTargetPrice: number;
}

export async function getOverview(apiKey: string, symbol: string): Promise<CompanyOverview> {
  const cacheKey = `overview:${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as CompanyOverview;

  const data = await httpGet<Record<string, string>>(
    `${BASE_URL}?function=OVERVIEW&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`,
  );

  checkAvResponse(data);
  if (!data || !data.Symbol) {
    throw new Error(`Company overview not found for ${symbol}`);
  }
  const mcap = data.MarketCapitalization;
  if (!data.Name || !mcap || mcap === "None" || mcap === "-" || mcap === "0") {
    throw new Error(`Alpha Vantage Rate Limit: empty overview for ${symbol}`);
  }

  const overview: CompanyOverview = {
    symbol: data.Symbol,
    name: data.Name,
    description: (data.Description ?? "").slice(0, 500),
    exchange: data.Exchange,
    sector: data.Sector,
    industry: data.Industry,
    marketCap: parseFloat(data.MarketCapitalization) || 0,
    peRatio: parseFloat(data.PERatio) || 0,
    pegRatio: parseFloat(data.PEGRatio) || 0,
    bookValue: parseFloat(data.BookValue) || 0,
    dividendYield: parseFloat(data.DividendYield) || 0,
    eps: parseFloat(data.EPS) || 0,
    revenuePerShare: parseFloat(data.RevenuePerShareTTM) || 0,
    profitMargin: parseFloat(data.ProfitMargin) || 0,
    week52High: parseFloat(data["52WeekHigh"]) || 0,
    week52Low: parseFloat(data["52WeekLow"]) || 0,
    analystTargetPrice: parseFloat(data.AnalystTargetPrice) || 0,
  };

  cache.set(cacheKey, overview);
  return overview;
}

export interface QuarterlyEarnings {
  fiscalDateEnding: string;
  reportedDate: string;
  reportedEPS: string;
  estimatedEPS: string;
  surprise: string;
  surprisePercentage: string;
}

export interface CompanyEarnings {
  symbol: string;
  annualEarnings: Array<{ fiscalDateEnding: string; reportedEPS: string }>;
  quarterlyEarnings: QuarterlyEarnings[];
}

export async function getEarningsHistory(
  apiKey: string,
  symbol: string,
  limit: number = 8,
): Promise<CompanyEarnings> {
  const cacheKey = `earnings-history:${symbol}:${limit}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as CompanyEarnings;

  const data = await httpGet<any>(
    `${BASE_URL}?function=EARNINGS&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`,
  );

  checkAvResponse(data);
  const result: CompanyEarnings = {
    symbol: data.symbol,
    annualEarnings: (data.annualEarnings || []).slice(0, 4),
    quarterlyEarnings: (data.quarterlyEarnings || []).slice(0, limit),
  };

  cache.set(cacheKey, result);
  return result;
}

export interface DividendHistory {
  symbol: string;
  data: Array<{ ex_dividend_date: string; declaration_date: string; record_date: string; payment_date: string; amount: string }>;
}

export async function getDividendHistory(
  apiKey: string,
  symbol: string,
): Promise<DividendHistory> {
  const cacheKey = `dividend-history:${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as DividendHistory;

  const data = await httpGet<any>(
    `${BASE_URL}?function=DIVIDENDS&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`,
  );

  checkAvResponse(data);
  const result: DividendHistory = {
    symbol: data.symbol,
    data: (data.data || []).slice(0, 20),
  };

  cache.set(cacheKey, result);
  return result;
}
