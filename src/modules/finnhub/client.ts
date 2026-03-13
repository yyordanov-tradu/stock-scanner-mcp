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
): Promise<NewsArticle[]> {
  const cacheKey = `news:${category}`;
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

  const result: NewsArticle[] = articles.slice(0, 20).map((a) => ({
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
): Promise<CompanyNews[]> {
  const cacheKey = `company-news:${symbol}:${from}:${to}`;
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

  const result: CompanyNews[] = articles.slice(0, 20).map((a) => ({
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
): Promise<EarningsEvent[]> {
  const cacheKey = `earnings:${from}:${to}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as EarningsEvent[];

  const data = await httpGet<{ earningsCalendar: EarningsEvent[] }>(
    `${BASE_URL}/calendar/earnings?from=${from}&to=${to}`,
    { headers: { "X-Finnhub-Token": apiKey } },
  );

  const result = data.earningsCalendar;
  cache.set(cacheKey, result);
  return result;
}
