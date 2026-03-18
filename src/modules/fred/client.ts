import { httpGet } from "../../shared/http.js";
import { TtlCache } from "../../shared/cache.js";

const BASE_URL = "https://api.stlouisfed.org/fred";
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

const cache = new TtlCache<unknown>(CACHE_TTL);

/** High-impact FRED release IDs with human-readable names. */
export const HIGH_IMPACT_RELEASES: Record<number, string> = {
  10: "Consumer Price Index",
  46: "Producer Price Index",
  50: "Employment Situation",
  53: "Gross Domestic Product",
  54: "Personal Income and Outlays",
  101: "Federal Funds Rate",
  7: "Advance Retail Sales",
  9: "Industrial Production and Capacity Utilization",
  18: "Housing Starts",
  32: "ISM Manufacturing",
};

/** Common series aliases mapped to FRED series IDs. */
export const COMMON_SERIES: Record<string, string> = {
  fed_funds: "DFF",
  cpi: "CPIAUCSL",
  core_cpi: "CPILFESL",
  ppi: "PPIFIS",
  gdp: "GDPC1",
  unemployment: "UNRATE",
  nonfarm_payrolls: "PAYEMS",
  treasury_10y: "DGS10",
  treasury_2y: "DGS2",
  initial_claims: "ICSA",
  core_pce: "PCEPILFE",
};

// --- Response interfaces ---

export interface FredObservation {
  date: string;
  value: string | null;
}

export interface FredSeriesInfo {
  id: string;
  title: string;
  frequency: string;
  units: string;
  seasonal_adjustment: string;
  last_updated: string;
}

export interface FredReleaseDate {
  release_id: number;
  release_name: string;
  date: string;
}

export interface FredSearchResult {
  id: string;
  title: string;
  frequency: string;
  units: string;
  popularity: number;
  last_updated: string;
}

export interface IndicatorResult {
  series: FredSeriesInfo;
  latest: FredObservation;
}

// --- Internal API response types ---

interface FredReleaseDatesResponse {
  release_dates: Array<{
    release_id: number;
    release_name: string;
    date: string;
  }>;
}

interface FredSeriesResponse {
  seriess: Array<{
    id: string;
    title: string;
    frequency: string;
    units: string;
    seasonal_adjustment: string;
    last_updated: string;
  }>;
}

interface FredObservationsResponse {
  observations: Array<{
    date: string;
    value: string;
  }>;
}

interface FredSearchResponse {
  seriess: Array<{
    id: string;
    title: string;
    frequency: string;
    units: string;
    popularity: number;
    last_updated: string;
  }>;
}

// --- Helper ---

function resolveSeriesId(seriesIdOrAlias: string): string {
  const lower = seriesIdOrAlias.toLowerCase();
  return COMMON_SERIES[lower] || seriesIdOrAlias.toUpperCase();
}

// --- Client functions ---

/**
 * Fetch upcoming economic release dates, filtered to high-impact releases only.
 */
export async function getEconomicCalendar(
  apiKey: string,
  limit = 60,
): Promise<FredReleaseDate[]> {
  const cacheKey = `calendar:${limit}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as FredReleaseDate[];

  const highImpactIds = new Set(Object.keys(HIGH_IMPACT_RELEASES).map(Number));

  const url =
    `${BASE_URL}/releases/dates` +
    `?api_key=${encodeURIComponent(apiKey)}` +
    `&file_type=json` +
    `&include_release_dates_with_no_data=true` +
    `&sort_order=asc` +
    `&limit=${limit}`;

  const data = await httpGet<FredReleaseDatesResponse>(url);

  const filtered = (data.release_dates || [])
    .filter((r) => highImpactIds.has(r.release_id))
    .map((r) => ({
      release_id: r.release_id,
      release_name: r.release_name,
      date: r.date,
    }));

  cache.set(cacheKey, filtered);
  return filtered;
}

/**
 * Get the latest value and metadata for a FRED series.
 * Accepts series IDs (e.g. "CPIAUCSL") or common aliases (e.g. "cpi").
 * FRED's "." value for missing data is converted to null.
 */
export async function getIndicator(
  apiKey: string,
  seriesIdOrAlias: string,
): Promise<IndicatorResult> {
  const seriesId = resolveSeriesId(seriesIdOrAlias);

  const cacheKey = `indicator:${seriesId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as IndicatorResult;

  const baseParams = `api_key=${encodeURIComponent(apiKey)}&file_type=json`;

  // Fetch series metadata
  const seriesUrl = `${BASE_URL}/series?series_id=${encodeURIComponent(seriesId)}&${baseParams}`;
  const seriesData = await httpGet<FredSeriesResponse>(seriesUrl);
  const s = seriesData.seriess[0];

  // Fetch latest observation
  const obsUrl =
    `${BASE_URL}/series/observations` +
    `?series_id=${encodeURIComponent(seriesId)}` +
    `&${baseParams}` +
    `&sort_order=desc&limit=1`;
  const obsData = await httpGet<FredObservationsResponse>(obsUrl);
  const obs = obsData.observations[0];

  const result: IndicatorResult = {
    series: {
      id: s.id,
      title: s.title,
      frequency: s.frequency,
      units: s.units,
      seasonal_adjustment: s.seasonal_adjustment,
      last_updated: s.last_updated,
    },
    latest: {
      date: obs?.date || "",
      value: obs?.value === "." ? null : (obs?.value || null),
    },
  };

  cache.set(cacheKey, result);
  return result;
}

/**
 * Get historical observations for a FRED series within a date range.
 * Supports units transformation (lin, chg, pch, pc1, etc.).
 * Filters out FRED's "." missing values.
 */
export async function getIndicatorHistory(
  apiKey: string,
  seriesIdOrAlias: string,
  startDate: string,
  endDate: string,
  units = "lin",
): Promise<FredObservation[]> {
  const seriesId = resolveSeriesId(seriesIdOrAlias);

  const cacheKey = `history:${seriesId}:${startDate}:${endDate}:${units}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as FredObservation[];

  const url =
    `${BASE_URL}/series/observations` +
    `?series_id=${encodeURIComponent(seriesId)}` +
    `&api_key=${encodeURIComponent(apiKey)}` +
    `&file_type=json` +
    `&observation_start=${encodeURIComponent(startDate)}` +
    `&observation_end=${encodeURIComponent(endDate)}` +
    `&units=${encodeURIComponent(units)}` +
    `&sort_order=asc`;

  const data = await httpGet<FredObservationsResponse>(url);

  const result: FredObservation[] = (data.observations || [])
    .filter((o) => o.value !== ".")
    .map((o) => ({
      date: o.date,
      value: o.value,
    }));

  cache.set(cacheKey, result);
  return result;
}

/**
 * Search FRED for economic data series by keyword.
 * Results sorted by search rank (relevance).
 */
export async function searchSeries(
  apiKey: string,
  query: string,
  limit = 10,
): Promise<FredSearchResult[]> {
  const cacheKey = `search:${query}:${limit}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as FredSearchResult[];

  const url =
    `${BASE_URL}/series/search` +
    `?search_text=${encodeURIComponent(query)}` +
    `&api_key=${encodeURIComponent(apiKey)}` +
    `&file_type=json` +
    `&limit=${limit}` +
    `&order_by=search_rank`;

  const data = await httpGet<FredSearchResponse>(url);

  const result: FredSearchResult[] = (data.seriess || []).map((s) => ({
    id: s.id,
    title: s.title,
    frequency: s.frequency,
    units: s.units,
    popularity: s.popularity,
    last_updated: s.last_updated,
  }));

  cache.set(cacheKey, result);
  return result;
}
