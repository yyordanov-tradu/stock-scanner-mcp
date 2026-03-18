import { TtlCache } from "../../shared/cache.js";
import { httpGet } from "../../shared/http.js";

const BASE_URL = "https://cdn.cboe.com/data/us/options/market_statistics/daily";

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

const cache = new TtlCache<PutCallEntry[]>(CACHE_TTL);

export interface PutCallEntry {
  date: string;
  callVolume: number;
  putVolume: number;
  totalVolume: number;
  putCallRatio: number;
}

/** CBOE JSON response shape (per-day endpoint). */
interface CboeDailyResponse {
  ratios: Array<{ name: string; value: string }>;
  "SUM OF ALL PRODUCTS"?: Array<{ name: string; call: number; put: number; total: number }>;
  "EQUITY OPTIONS"?: Array<{ name: string; call: number; put: number; total: number }>;
  "INDEX OPTIONS"?: Array<{ name: string; call: number; put: number; total: number }>;
}

/** Maps our type param to the ratio name in CBOE JSON + volume section key. */
const TYPE_MAP: Record<string, { ratioName: string; volumeKey: keyof CboeDailyResponse }> = {
  total: { ratioName: "TOTAL PUT/CALL RATIO", volumeKey: "SUM OF ALL PRODUCTS" },
  equity: { ratioName: "EQUITY PUT/CALL RATIO", volumeKey: "EQUITY OPTIONS" },
  index: { ratioName: "INDEX PUT/CALL RATIO", volumeKey: "INDEX OPTIONS" },
};

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function parseDailyJson(json: CboeDailyResponse, date: string, type: string): PutCallEntry | null {
  const mapping = TYPE_MAP[type];
  if (!mapping) return null;

  const ratioObj = json.ratios?.find(r => r.name === mapping.ratioName);
  if (!ratioObj) return null;

  const putCallRatio = Number(ratioObj.value);
  if (isNaN(putCallRatio)) return null;

  const volumeSection = json[mapping.volumeKey] as Array<{ name: string; call: number; put: number; total: number }> | undefined;
  const volumeRow = volumeSection?.find(v => v.name === "VOLUME");

  return {
    date,
    callVolume: volumeRow?.call ?? 0,
    putVolume: volumeRow?.put ?? 0,
    totalVolume: volumeRow?.total ?? 0,
    putCallRatio,
  };
}

async function fetchDay(date: string): Promise<CboeDailyResponse | null> {
  const url = `${BASE_URL}/${date}_daily_options`;
  try {
    return await httpGet<CboeDailyResponse>(url);
  } catch (err) {
    // 403/404 = non-trading day (weekend, holiday) — skip silently
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("HTTP 403") || msg.includes("HTTP 404")) {
      return null;
    }
    throw err;
  }
}

async function fetchDays(type: string, days: number): Promise<PutCallEntry[]> {
  const mapping = TYPE_MAP[type];
  if (!mapping) {
    throw new Error(`Unknown put/call ratio type: ${type}`);
  }

  const entries: PutCallEntry[] = [];
  const cursor = new Date();
  // Start from yesterday (today's data may not be published yet)
  cursor.setDate(cursor.getDate() - 1);

  // Try at most days * 2 calendar days to account for weekends/holidays
  const maxAttempts = days * 2 + 10;
  let attempts = 0;

  while (entries.length < days && attempts < maxAttempts) {
    attempts++;
    if (isWeekend(cursor)) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }

    const dateStr = formatDate(cursor);
    const json = await fetchDay(dateStr);
    if (json) {
      const entry = parseDailyJson(json, dateStr, type);
      if (entry) {
        entries.push(entry);
      }
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  return entries;
}

export async function getPutCallRatio(type: string, days: number): Promise<PutCallEntry[]> {
  return cache.getOrFetch(`pcr:${type}:${days}`, () => fetchDays(type, days));
}
