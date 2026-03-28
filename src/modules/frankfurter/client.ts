import { httpGet } from "../../shared/http.js";
import { TtlCache } from "../../shared/cache.js";

const BASE_URL = "https://api.frankfurter.dev/v1";

// ECB data updates once daily at ~16:00 CET
const CACHE_TTL_LATEST = 60 * 60 * 1000; // 1 hour
const CACHE_TTL_STATIC = 24 * 60 * 60 * 1000; // 24 hours
const MAX_TIMESERIES_DAYS = 90;

const latestCache = new TtlCache<unknown>(CACHE_TTL_LATEST);
const staticCache = new TtlCache<unknown>(CACHE_TTL_STATIC);

export interface RatesResponse {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

export interface TimeSeriesResponse {
  amount: number;
  base: string;
  start_date: string;
  end_date: string;
  rates: Record<string, Record<string, number>>;
}

export type CurrencyMap = Record<string, string>;

function buildUrl(path: string, params: Record<string, string | undefined>): string {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

function capEndDate(startDate: string, endDate?: string): string {
  const start = new Date(startDate);
  const maxEnd = new Date(start.getTime() + MAX_TIMESERIES_DAYS * 24 * 60 * 60 * 1000);
  if (!endDate) return maxEnd.toISOString().split("T")[0];
  const requested = new Date(endDate);
  const capped = requested < maxEnd ? requested : maxEnd;
  return capped.toISOString().split("T")[0];
}

export async function getLatestRates(
  base: string,
  symbols?: string,
): Promise<RatesResponse> {
  const cacheKey = `latest:${base}:${symbols ?? "all"}`;
  const cached = latestCache.get(cacheKey);
  if (cached) return cached as RatesResponse;

  const url = buildUrl("/latest", { base, symbols });
  const data = await httpGet<RatesResponse>(url);

  latestCache.set(cacheKey, data);
  return data;
}

export async function getHistoricalRates(
  base: string,
  date: string,
  symbols?: string,
): Promise<RatesResponse> {
  const cacheKey = `historical:${base}:${date}:${symbols ?? "all"}`;
  const cached = staticCache.get(cacheKey);
  if (cached) return cached as RatesResponse;

  const url = buildUrl(`/${encodeURIComponent(date)}`, { base, symbols });
  const data = await httpGet<RatesResponse>(url);

  staticCache.set(cacheKey, data);
  return data;
}

export async function getTimeSeries(
  base: string,
  symbols: string,
  startDate: string,
  endDate?: string,
): Promise<TimeSeriesResponse> {
  const cappedEnd = capEndDate(startDate, endDate);
  const cacheKey = `timeseries:${base}:${symbols}:${startDate}:${cappedEnd}`;
  const cached = latestCache.get(cacheKey);
  if (cached) return cached as TimeSeriesResponse;

  const path = `/${encodeURIComponent(startDate)}..${encodeURIComponent(cappedEnd)}`;
  const url = buildUrl(path, { base, symbols });
  const data = await httpGet<TimeSeriesResponse>(url);

  latestCache.set(cacheKey, data);
  return data;
}

export async function convertCurrency(
  amount: number,
  from: string,
  to: string,
): Promise<RatesResponse> {
  const cacheKey = `convert:${amount}:${from}:${to}`;
  const cached = latestCache.get(cacheKey);
  if (cached) return cached as RatesResponse;

  const url = buildUrl("/latest", {
    amount: String(amount),
    base: from,
    symbols: to,
  });
  const data = await httpGet<RatesResponse>(url);

  latestCache.set(cacheKey, data);
  return data;
}

export async function getCurrencies(): Promise<CurrencyMap> {
  const cacheKey = "currencies";
  const cached = staticCache.get(cacheKey);
  if (cached) return cached as CurrencyMap;

  const url = `${BASE_URL}/currencies`;
  const data = await httpGet<CurrencyMap>(url);

  staticCache.set(cacheKey, data);
  return data;
}
