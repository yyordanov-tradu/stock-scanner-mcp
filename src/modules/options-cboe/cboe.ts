import { TtlCache } from "../../shared/cache.js";
import { httpGet } from "../../shared/http.js";

const CSV_URLS: Record<string, string> = {
  total: "https://cdn.cboe.com/resources/options/volume_and_call_put_ratios/totalpc.csv",
  equity: "https://cdn.cboe.com/resources/options/volume_and_call_put_ratios/equitypc.csv",
  index: "https://cdn.cboe.com/resources/options/volume_and_call_put_ratios/indexpcarchive.csv",
};

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

const cache = new TtlCache<PutCallEntry[]>(CACHE_TTL);

export interface PutCallEntry {
  date: string;
  callVolume: number;
  putVolume: number;
  totalVolume: number;
  putCallRatio: number;
}

function parseDate(mmddyyyy: string): string {
  const parts = mmddyyyy.trim().split("/");
  if (parts.length !== 3) return "";
  const [mm, dd, yyyy] = parts;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function parseCsvRows(csv: string): PutCallEntry[] {
  const lines = csv.split("\n");
  const entries: PutCallEntry[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(",");
    if (cols.length < 5) continue;

    const date = parseDate(cols[0]);
    if (!date) continue;

    const callVolume = Number(cols[1]);
    const putVolume = Number(cols[2]);
    const totalVolume = Number(cols[3]);
    const putCallRatio = Number(cols[4]);

    if (isNaN(callVolume) || isNaN(putVolume) || isNaN(totalVolume) || isNaN(putCallRatio)) {
      continue;
    }

    entries.push({ date, callVolume, putVolume, totalVolume, putCallRatio });
  }

  return entries;
}

async function fetchCsv(type: string): Promise<PutCallEntry[]> {
  const url = CSV_URLS[type];
  if (!url) {
    throw new Error(`Unknown put/call ratio type: ${type}`);
  }

  const text = await httpGet<string>(url, { responseType: "text" });
  const entries = parseCsvRows(text);
  entries.sort((a, b) => b.date.localeCompare(a.date));
  return entries;
}

export async function getPutCallRatio(type: string, days: number): Promise<PutCallEntry[]> {
  const allEntries = await cache.getOrFetch(`pcr:${type}`, () => fetchCsv(type));
  return allEntries.slice(0, days);
}
