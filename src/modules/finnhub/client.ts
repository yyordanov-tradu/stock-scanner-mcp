import { httpGet } from "../../shared/http.js";
import { TtlCache } from "../../shared/cache.js";

const BASE_URL = "https://finnhub.io/api/v1";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const cache = new TtlCache<unknown>(CACHE_TTL);

export interface NewsArticle {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  source: string;
  summary: string;
  url: string;
  related: string;
}

export async function getMarketNews(
  apiKey: string,
  category: string = "general",
  limit: number = 20,
): Promise<NewsArticle[]> {
  const cacheKey = `news:${category}:${limit}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as NewsArticle[];

  const articles = await httpGet<
    Array<{
      category: string;
      datetime: number;
      headline: string;
      id: number;
      source: string;
      summary: string;
      url: string;
      related: string;
    }>
  >(`${BASE_URL}/news?category=${encodeURIComponent(category)}`, {
    headers: { "X-Finnhub-Token": apiKey },
  });

  const result: NewsArticle[] = articles.slice(0, limit).map((a) => ({
    category: a.category,
    datetime: a.datetime,
    headline: a.headline,
    id: a.id,
    source: a.source,
    summary: a.summary.slice(0, 300),
    url: a.url,
    related: a.related,
  }));

  cache.set(cacheKey, result);
  return result;
}

export interface CompanyNews {
  category: string;
  datetime: number;
  headline: string;
  source: string;
  summary: string;
  url: string;
}

export async function getCompanyNews(
  apiKey: string,
  symbol: string,
  from: string,
  to: string,
  limit: number = 20,
): Promise<CompanyNews[]> {
  const cacheKey = `company-news:${symbol}:${from}:${to}:${limit}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as CompanyNews[];

  const articles = await httpGet<
    Array<{
      category: string;
      datetime: number;
      headline: string;
      source: string;
      summary: string;
      url: string;
    }>
  >(
    `${BASE_URL}/company-news?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}`,
    { headers: { "X-Finnhub-Token": apiKey } },
  );

  const result: CompanyNews[] = articles.slice(0, limit).map((a) => ({
    category: a.category,
    datetime: a.datetime,
    headline: a.headline,
    source: a.source,
    summary: a.summary.slice(0, 300),
    url: a.url,
  }));

  cache.set(cacheKey, result);
  return result;
}

export interface EarningsEvent {
  date: string;
  symbol: string;
  actual: number | null;
  estimate: number | null;
  period: string;
  quarter: number;
  year: number;
}

export async function getEarningsCalendar(
  apiKey: string,
  from: string,
  to: string,
  symbol?: string,
): Promise<EarningsEvent[]> {
  const cacheKey = `earnings:${from}:${to}:${symbol ?? "all"}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as EarningsEvent[];

  let url = `${BASE_URL}/calendar/earnings?from=${from}&to=${to}`;
  if (symbol) {
    url += `&symbol=${encodeURIComponent(symbol)}`;
  }

  const data = await httpGet<{ earningsCalendar: EarningsEvent[] }>(
    url,
    { headers: { "X-Finnhub-Token": apiKey } },
  );

  const result = data.earningsCalendar;
  cache.set(cacheKey, result);
  return result;
}

export interface AnalystRecommendation {
  buy: number;
  hold: number;
  period: string;
  sell: number;
  strongBuy: number;
  strongSell: number;
  symbol: string;
}

export async function getAnalystRecommendations(
  apiKey: string,
  symbol: string,
): Promise<AnalystRecommendation[]> {
  const cacheKey = `recommendations:${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as AnalystRecommendation[];

  const data = await httpGet<AnalystRecommendation[]>(
    `${BASE_URL}/stock/recommendation?symbol=${encodeURIComponent(symbol)}`,
    { headers: { "X-Finnhub-Token": apiKey } },
  );

  cache.set(cacheKey, data);
  return data;
}

export interface CompanyProfile {
  country: string;
  currency: string;
  exchange: string;
  finnhubIndustry: string;
  ipo: string;
  logo: string;
  marketCapitalization: number;
  name: string;
  phone: string;
  shareOutstanding: number;
  ticker: string;
  weburl: string;
}

export async function getCompanyProfile(
  apiKey: string,
  symbol: string,
): Promise<CompanyProfile> {
  const cacheKey = `profile:${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as CompanyProfile;

  const data = await httpGet<CompanyProfile>(
    `${BASE_URL}/stock/profile2?symbol=${encodeURIComponent(symbol)}`,
    { headers: { "X-Finnhub-Token": apiKey } },
  );

  cache.set(cacheKey, data);
  return data;
}

export async function getPeers(
  apiKey: string,
  symbol: string,
): Promise<string[]> {
  const cacheKey = `peers:${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as string[];

  const data = await httpGet<string[]>(
    `${BASE_URL}/stock/peers?symbol=${encodeURIComponent(symbol)}`,
    { headers: { "X-Finnhub-Token": apiKey } },
  );

  cache.set(cacheKey, data);
  return data;
}

export interface MarketStatus {
  exchange: string;
  holiday: string | null;
  isOpen: boolean;
  session: string;
  t: number;
  timezone: string;
}

export async function getMarketStatus(
  apiKey: string,
  exchange: string,
): Promise<MarketStatus> {
  const cacheKey = `market-status:${exchange}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as MarketStatus;

  const data = await httpGet<MarketStatus>(
    `${BASE_URL}/stock/market-status?exchange=${encodeURIComponent(exchange)}`,
    { headers: { "X-Finnhub-Token": apiKey } },
  );

  cache.set(cacheKey, data);
  return data;
}

export interface Quote {
  c: number;  // current price
  d: number;  // change
  dp: number; // percent change
  h: number;  // high
  l: number;  // low
  o: number;  // open
  pc: number; // previous close
  t: number;  // timestamp
}

export async function getQuote(
  apiKey: string,
  symbol: string,
): Promise<Quote> {
  const cacheKey = `quote:${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as Quote;

  const data = await httpGet<Quote>(
    `${BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}`,
    { headers: { "X-Finnhub-Token": apiKey } },
  );

  cache.set(cacheKey, data);
  return data;
}

export async function getShortInterest(
  apiKey: string,
  symbol: string,
): Promise<any> {
  const cacheKey = `short-interest:${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // Finnhub Basic Financials endpoint often includes some short metrics
  const data = await httpGet<any>(
    `${BASE_URL}/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all`,
    { headers: { "X-Finnhub-Token": apiKey } },
  );

  const result = {
    symbol: data.symbol,
    metric: {
      "52WeekHigh": data.metric?.["52WeekHigh"],
      "52WeekLow": data.metric?.["52WeekLow"],
      "shortInterest": data.metric?.["shortInterest"],
      "shortRatio": data.metric?.["shortRatio"],
      "shortPercentOfFloat": data.metric?.["shortPercentOfFloat"],
    }
  };

  cache.set(cacheKey, result);
  return result;
}
