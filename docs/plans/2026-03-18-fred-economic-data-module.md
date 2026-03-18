# FRED Economic Data Module Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `fred` module providing economic calendar and indicator data from the FRED API (Federal Reserve Economic Data).

**Architecture:** New module `src/modules/fred/` following existing module pattern (index.ts factory + client.ts HTTP + tests). Four tools: `fred_economic_calendar`, `fred_indicator`, `fred_indicator_history`, `fred_search`. Gated by `FRED_API_KEY` env var.

**Tech Stack:** TypeScript, zod schemas, FRED REST API, TtlCache (30min TTL for monthly/quarterly data)

**GitHub Issue:** #101

---

## Key Reference

- **FRED API base URL:** `https://api.stlouisfed.org/fred`
- **Auth:** Query param `api_key=KEY` (FRED only supports this — documented deviation from headers-only standard)
- **Rate limit:** 120 requests/minute
- **Response format:** Add `&file_type=json` to all requests
- **Missing values:** FRED returns `value: "."` — handle as `null`

### Curated Release IDs (for economic calendar filtering)

| Release ID | Name |
|-----------|------|
| 10 | Consumer Price Index (CPI) |
| 46 | Producer Price Index (PPI) |
| 50 | Employment Situation (NFP/Unemployment) |
| 53 | Gross Domestic Product (GDP) |
| 54 | Personal Income and Outlays (PCE) |
| 101 | FOMC Press Release (Fed Funds Rate) |
| 7 | Initial Jobless Claims |
| 9 | Retail Sales |
| 18 | H.15 Selected Interest Rates (Treasury Yields) |
| 32 | ISM Manufacturing |

### Key Series IDs

| Series | ID | Frequency |
|--------|------|-----------|
| Fed Funds Rate (daily) | `DFF` | Daily |
| CPI All Urban SA | `CPIAUCSL` | Monthly |
| Core CPI | `CPILFESL` | Monthly |
| PPI Final Demand | `PPIFIS` | Monthly |
| Real GDP | `GDPC1` | Quarterly |
| Unemployment Rate | `UNRATE` | Monthly |
| Nonfarm Payrolls | `PAYEMS` | Monthly |
| 10Y Treasury | `DGS10` | Daily |
| 2Y Treasury | `DGS2` | Daily |
| Initial Claims | `ICSA` | Weekly |
| Core PCE | `PCEPILFE` | Monthly |

---

## Task 1: Scaffold module files and add to config/registry

**Files:**
- Create: `src/modules/fred/index.ts`
- Create: `src/modules/fred/client.ts`
- Create: `src/modules/fred/__tests__/client.test.ts`
- Modify: `src/config.ts:21-28`
- Modify: `src/index.ts:16-44`

### Step 1: Create empty client.ts

```typescript
// src/modules/fred/client.ts
import { httpGet } from "../../shared/http.js";
import { TtlCache } from "../../shared/cache.js";

const BASE_URL = "https://api.stlouisfed.org/fred";
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes — economic data is monthly/quarterly

const cache = new TtlCache<unknown>(CACHE_TTL);

// Curated high-impact release IDs for the economic calendar
export const HIGH_IMPACT_RELEASES: Record<number, string> = {
  10: "Consumer Price Index (CPI)",
  46: "Producer Price Index (PPI)",
  50: "Employment Situation (NFP)",
  53: "Gross Domestic Product (GDP)",
  54: "Personal Income & Outlays (PCE)",
  101: "FOMC Press Release",
  7: "Initial Jobless Claims",
  9: "Retail Sales",
  18: "Interest Rates (Treasury Yields)",
  32: "ISM Manufacturing",
};

// Common series lookup for the indicator tool
export const COMMON_SERIES: Record<string, string> = {
  "fed_funds": "DFF",
  "cpi": "CPIAUCSL",
  "core_cpi": "CPILFESL",
  "ppi": "PPIFIS",
  "gdp": "GDPC1",
  "unemployment": "UNRATE",
  "nonfarm_payrolls": "PAYEMS",
  "treasury_10y": "DGS10",
  "treasury_2y": "DGS2",
  "initial_claims": "ICSA",
  "core_pce": "PCEPILFE",
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
```

### Step 2: Create empty index.ts with module factory

```typescript
// src/modules/fred/index.ts
import type { ModuleDefinition } from "../../shared/types.js";

export function createFredModule(apiKey: string): ModuleDefinition {
  return {
    name: "fred",
    description: "FRED economic data: calendar, indicators, interest rates, inflation",
    requiredEnvVars: ["FRED_API_KEY"],
    tools: [],
  };
}
```

### Step 3: Create empty test file

```typescript
// src/modules/fred/__tests__/client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
```

### Step 4: Add FRED_API_KEY to config.ts

In `src/config.ts`, add to the `env` object at line 24-27:

```typescript
    env: {
      FINNHUB_API_KEY: process.env.FINNHUB_API_KEY,
      ALPHA_VANTAGE_API_KEY: process.env.ALPHA_VANTAGE_API_KEY,
      FRED_API_KEY: process.env.FRED_API_KEY,
    },
```

### Step 5: Register module in src/index.ts

Add import after line 23:
```typescript
import { createFredModule } from "./modules/fred/index.js";
```

Add to `buildModules()` after the alpha-vantage block (after line 41):
```typescript
  if (env.FRED_API_KEY) {
    modules.push(createFredModule(env.FRED_API_KEY));
  }
```

Update help text tool count and add fred module line (around line 60-68).

### Step 6: Verify it compiles

Run: `npm run lint`
Expected: PASS (no type errors)

### Step 7: Commit

```bash
git add src/modules/fred/ src/config.ts src/index.ts
git commit -m "chore: scaffold fred economic data module (#101)"
```

---

## Task 2: Implement `fred_economic_calendar` tool (TDD)

**Files:**
- Modify: `src/modules/fred/client.ts`
- Modify: `src/modules/fred/index.ts`
- Modify: `src/modules/fred/__tests__/client.test.ts`

### Step 1: Write the failing test

```typescript
// Add to __tests__/client.test.ts
import { getEconomicCalendar, HIGH_IMPACT_RELEASES } from "../client.js";

describe("getEconomicCalendar", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches upcoming release dates and filters to high-impact", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        release_dates: [
          { release_id: 10, release_name: "Consumer Price Index", date: "2026-04-10" },
          { release_id: 46, release_name: "Producer Price Index", date: "2026-04-11" },
          { release_id: 999, release_name: "Some Obscure Release", date: "2026-04-12" },
          { release_id: 50, release_name: "Employment Situation", date: "2026-04-15" },
        ],
      }),
    });

    const result = await getEconomicCalendar("test-key");

    // Should filter out release_id 999 (not in curated list)
    expect(result).toHaveLength(3);
    expect(result[0].release_name).toBe("Consumer Price Index");
    expect(result[1].release_name).toBe("Producer Price Index");
    expect(result[2].release_name).toBe("Employment Situation");
  });

  it("passes API key as query parameter", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ release_dates: [] }),
    });

    await getEconomicCalendar("my-fred-key");

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).toContain("api_key=my-fred-key");
    expect(calledUrl).toContain("include_release_dates_with_no_data=true");
    expect(calledUrl).toContain("file_type=json");
  });

  it("returns empty array when no upcoming releases", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ release_dates: [] }),
    });

    const result = await getEconomicCalendar("test-key");
    expect(result).toEqual([]);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npx vitest run src/modules/fred/__tests__/client.test.ts`
Expected: FAIL — `getEconomicCalendar` not exported

### Step 3: Implement getEconomicCalendar in client.ts

Add to `src/modules/fred/client.ts`:

```typescript
interface FredReleaseDatesResponse {
  release_dates: Array<{
    release_id: number;
    release_name: string;
    date: string;
  }>;
}

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
```

### Step 4: Run test to verify it passes

Run: `npx vitest run src/modules/fred/__tests__/client.test.ts`
Expected: PASS (all 3 tests)

### Step 5: Wire up the tool in index.ts

```typescript
// Add to src/modules/fred/index.ts
import { z } from "zod";
import type { ModuleDefinition, ToolDefinition } from "../../shared/types.js";
import { successResult } from "../../shared/types.js";
import { withMetadata } from "../../shared/utils.js";
import { getEconomicCalendar } from "./client.js";

export function createFredModule(apiKey: string): ModuleDefinition {
  const metadata = { source: "fred", dataDelay: "varies by indicator" };

  const calendarTool: ToolDefinition = {
    name: "fred_economic_calendar",
    description:
      "Get upcoming US economic release dates (FOMC, CPI, PPI, NFP, GDP, PCE, " +
      "jobless claims, retail sales, ISM, treasury rates). " +
      "Filters to high-impact releases only. " +
      "Use this to identify macro catalysts that could move markets.",
    inputSchema: z.object({
      limit: z
        .number()
        .optional()
        .default(60)
        .describe("Max raw results to fetch before filtering (default: 60)"),
    }),
    handler: withMetadata(async (params) => {
      const releases = await getEconomicCalendar(apiKey, params.limit as number);
      return successResult(JSON.stringify(releases, null, 2));
    }, metadata),
  };

  return {
    name: "fred",
    description: "FRED economic data: calendar, indicators, interest rates, inflation",
    requiredEnvVars: ["FRED_API_KEY"],
    tools: [calendarTool],
  };
}
```

### Step 6: Verify it compiles

Run: `npm run lint`
Expected: PASS

### Step 7: Commit

```bash
git add src/modules/fred/
git commit -m "feat(fred): add economic calendar tool (#101)"
```

---

## Task 3: Implement `fred_indicator` tool (TDD)

**Files:**
- Modify: `src/modules/fred/client.ts`
- Modify: `src/modules/fred/index.ts`
- Modify: `src/modules/fred/__tests__/client.test.ts`

### Step 1: Write the failing test

```typescript
// Add to __tests__/client.test.ts
import { getIndicator, COMMON_SERIES } from "../client.js";

describe("getIndicator", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches latest value for a series ID", async () => {
    // First call: series metadata. Second call: observations.
    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          seriess: [{
            id: "CPIAUCSL",
            title: "Consumer Price Index for All Urban Consumers",
            frequency: "Monthly",
            units: "Index 1982-1984=100",
            seasonal_adjustment: "Seasonally Adjusted",
            last_updated: "2026-03-12 07:36:03-05",
          }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          observations: [
            { date: "2026-02-01", value: "320.125" },
          ],
        }),
      });

    const result = await getIndicator("test-key", "CPIAUCSL");

    expect(result.series.id).toBe("CPIAUCSL");
    expect(result.series.title).toContain("Consumer Price Index");
    expect(result.latest.value).toBe("320.125");
    expect(result.latest.date).toBe("2026-02-01");
  });

  it("resolves common aliases to series IDs", async () => {
    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ seriess: [{ id: "CPIAUCSL", title: "CPI", frequency: "Monthly", units: "Index", seasonal_adjustment: "SA", last_updated: "" }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ observations: [{ date: "2026-02-01", value: "320.0" }] }),
      });

    await getIndicator("test-key", "cpi");

    const firstUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(firstUrl).toContain("series_id=CPIAUCSL");
  });

  it("handles missing value (FRED dot notation)", async () => {
    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ seriess: [{ id: "DGS10", title: "10Y", frequency: "Daily", units: "%", seasonal_adjustment: "NSA", last_updated: "" }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ observations: [{ date: "2026-03-17", value: "." }] }),
      });

    const result = await getIndicator("test-key", "DGS10");
    expect(result.latest.value).toBeNull();
  });
});
```

### Step 2: Run test to verify it fails

Run: `npx vitest run src/modules/fred/__tests__/client.test.ts`
Expected: FAIL — `getIndicator` not exported

### Step 3: Implement getIndicator in client.ts

```typescript
// Add to client.ts

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

export interface IndicatorResult {
  series: FredSeriesInfo;
  latest: FredObservation;
}

export async function getIndicator(
  apiKey: string,
  seriesIdOrAlias: string,
): Promise<IndicatorResult> {
  // Resolve alias to series ID
  const lower = seriesIdOrAlias.toLowerCase();
  const seriesId = COMMON_SERIES[lower] || seriesIdOrAlias.toUpperCase();

  const cacheKey = `indicator:${seriesId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as IndicatorResult;

  const baseParams =
    `api_key=${encodeURIComponent(apiKey)}&file_type=json`;

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
```

### Step 4: Run test to verify it passes

Run: `npx vitest run src/modules/fred/__tests__/client.test.ts`
Expected: PASS (all tests including new ones)

### Step 5: Wire up tool in index.ts

Add to the tools array in `createFredModule()`:

```typescript
  const indicatorTool: ToolDefinition = {
    name: "fred_indicator",
    description:
      "Get the latest value of a US economic indicator from FRED. " +
      "Accepts FRED series IDs (e.g. 'CPIAUCSL', 'DFF', 'UNRATE') or common aliases: " +
      "cpi, core_cpi, ppi, gdp, unemployment, nonfarm_payrolls, fed_funds, " +
      "treasury_10y, treasury_2y, initial_claims, core_pce. " +
      "Returns the indicator metadata (title, frequency, units) and latest observation.",
    inputSchema: z.object({
      series_id: z
        .string()
        .describe("FRED series ID or alias (e.g. 'cpi', 'UNRATE', 'treasury_10y')"),
    }),
    handler: withMetadata(async (params) => {
      const result = await getIndicator(apiKey, params.series_id as string);
      return successResult(JSON.stringify(result, null, 2));
    }, metadata),
  };
```

Add `getIndicator` to the imports from `./client.js`.

Add `indicatorTool` to the `tools: [calendarTool, indicatorTool]` array.

### Step 6: Verify it compiles

Run: `npm run lint`
Expected: PASS

### Step 7: Commit

```bash
git add src/modules/fred/
git commit -m "feat(fred): add indicator tool with alias resolution (#101)"
```

---

## Task 4: Implement `fred_indicator_history` tool (TDD)

**Files:**
- Modify: `src/modules/fred/client.ts`
- Modify: `src/modules/fred/index.ts`
- Modify: `src/modules/fred/__tests__/client.test.ts`

### Step 1: Write the failing test

```typescript
// Add to __tests__/client.test.ts
import { getIndicatorHistory } from "../client.js";

describe("getIndicatorHistory", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches observations for a date range", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        observations: [
          { date: "2026-01-01", value: "318.5" },
          { date: "2026-02-01", value: "320.1" },
          { date: "2026-03-01", value: "321.8" },
        ],
      }),
    });

    const result = await getIndicatorHistory(
      "test-key", "CPIAUCSL", "2026-01-01", "2026-03-31",
    );

    expect(result).toHaveLength(3);
    expect(result[0].date).toBe("2026-01-01");
    expect(result[2].value).toBe("321.8");
  });

  it("supports units parameter for percent change", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        observations: [
          { date: "2026-01-01", value: "3.2" },
        ],
      }),
    });

    await getIndicatorHistory("test-key", "CPIAUCSL", "2026-01-01", "2026-03-31", "pc1");

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).toContain("units=pc1");
  });

  it("filters out missing values (dot notation)", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        observations: [
          { date: "2026-03-14", value: "4.25" },
          { date: "2026-03-15", value: "." },
          { date: "2026-03-16", value: "4.30" },
        ],
      }),
    });

    const result = await getIndicatorHistory(
      "test-key", "DGS10", "2026-03-14", "2026-03-16",
    );

    // Missing values filtered out
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.value !== null)).toBe(true);
  });

  it("resolves aliases to series IDs", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ observations: [] }),
    });

    await getIndicatorHistory("test-key", "cpi", "2026-01-01", "2026-03-31");

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).toContain("series_id=CPIAUCSL");
  });
});
```

### Step 2: Run test to verify it fails

Run: `npx vitest run src/modules/fred/__tests__/client.test.ts`
Expected: FAIL — `getIndicatorHistory` not exported

### Step 3: Implement getIndicatorHistory in client.ts

```typescript
export async function getIndicatorHistory(
  apiKey: string,
  seriesIdOrAlias: string,
  startDate: string,
  endDate: string,
  units = "lin",
): Promise<FredObservation[]> {
  const lower = seriesIdOrAlias.toLowerCase();
  const seriesId = COMMON_SERIES[lower] || seriesIdOrAlias.toUpperCase();

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

  const result = (data.observations || [])
    .filter((o) => o.value !== ".")
    .map((o) => ({
      date: o.date,
      value: o.value,
    }));

  cache.set(cacheKey, result);
  return result;
}
```

### Step 4: Run test to verify it passes

Run: `npx vitest run src/modules/fred/__tests__/client.test.ts`
Expected: PASS

### Step 5: Wire up tool in index.ts

```typescript
  const historyTool: ToolDefinition = {
    name: "fred_indicator_history",
    description:
      "Get historical values for a US economic indicator from FRED. " +
      "Accepts same series IDs/aliases as fred_indicator. " +
      "Supports units transformation: 'lin' (raw level), 'chg' (change), " +
      "'pc1' (% change from year ago — useful for YoY inflation), " +
      "'pch' (% change from prior period). " +
      "Use 'pc1' with CPI/PPI to get YoY inflation rates directly.",
    inputSchema: z.object({
      series_id: z.string().describe("FRED series ID or alias"),
      start_date: z.string().describe("Start date YYYY-MM-DD"),
      end_date: z.string().describe("End date YYYY-MM-DD"),
      units: z
        .enum(["lin", "chg", "ch1", "pch", "pc1", "pca"])
        .optional()
        .default("lin")
        .describe("Units: lin=level, pch=% change, pc1=YoY % change (default: lin)"),
    }),
    handler: withMetadata(async (params) => {
      const result = await getIndicatorHistory(
        apiKey,
        params.series_id as string,
        params.start_date as string,
        params.end_date as string,
        params.units as string,
      );
      return successResult(JSON.stringify(result, null, 2));
    }, metadata),
  };
```

Add to tools array and imports.

### Step 6: Verify

Run: `npm run lint`
Expected: PASS

### Step 7: Commit

```bash
git add src/modules/fred/
git commit -m "feat(fred): add indicator history tool with units transformation (#101)"
```

---

## Task 5: Implement `fred_search` tool (TDD)

**Files:**
- Modify: `src/modules/fred/client.ts`
- Modify: `src/modules/fred/index.ts`
- Modify: `src/modules/fred/__tests__/client.test.ts`

### Step 1: Write the failing test

```typescript
// Add to __tests__/client.test.ts
import { searchSeries } from "../client.js";

describe("searchSeries", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("searches FRED series by keyword", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        seriess: [
          {
            id: "CPIAUCSL",
            title: "Consumer Price Index for All Urban Consumers",
            frequency: "Monthly",
            units: "Index 1982-1984=100",
            popularity: 95,
            last_updated: "2026-03-12",
          },
          {
            id: "CPILFESL",
            title: "CPI Less Food and Energy",
            frequency: "Monthly",
            units: "Index 1982-1984=100",
            popularity: 80,
            last_updated: "2026-03-12",
          },
        ],
      }),
    });

    const results = await searchSeries("test-key", "consumer price index", 10);

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe("CPIAUCSL");
    expect(results[0].popularity).toBe(95);
  });

  it("encodes search text in URL", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ seriess: [] }),
    });

    await searchSeries("test-key", "consumer price index", 5);

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).toContain("search_text=consumer%20price%20index");
    expect(calledUrl).toContain("limit=5");
    expect(calledUrl).toContain("order_by=search_rank");
  });
});
```

### Step 2: Run test to verify it fails

Run: `npx vitest run src/modules/fred/__tests__/client.test.ts`
Expected: FAIL

### Step 3: Implement searchSeries in client.ts

```typescript
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

  const result = (data.seriess || []).map((s) => ({
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
```

### Step 4: Run test to verify it passes

Run: `npx vitest run src/modules/fred/__tests__/client.test.ts`
Expected: PASS

### Step 5: Wire up tool in index.ts

```typescript
  const searchTool: ToolDefinition = {
    name: "fred_search",
    description:
      "Search FRED for economic data series by keyword. " +
      "Returns series IDs that can be used with fred_indicator and fred_indicator_history. " +
      "Results sorted by relevance. Use to discover series IDs for niche indicators.",
    inputSchema: z.object({
      query: z.string().describe("Search keywords (e.g. 'consumer price index', 'housing starts')"),
      limit: z.number().optional().default(10).describe("Max results (default: 10, max: 50)"),
    }),
    handler: withMetadata(async (params) => {
      const results = await searchSeries(apiKey, params.query as string, params.limit as number);
      return successResult(JSON.stringify(results, null, 2));
    }, metadata),
  };
```

Add to tools array and imports.

### Step 6: Verify all quality gates

Run: `npm run lint && npm test && npm run build`
Expected: ALL PASS

### Step 7: Commit

```bash
git add src/modules/fred/
git commit -m "feat(fred): add series search tool (#101)"
```

---

## Task 6: Update help text, README config, and final verification

**Files:**
- Modify: `src/index.ts:60-68` (help text)

### Step 1: Update help text in src/index.ts

Update the MODULES section around line 60:

```
MODULES (43 tools total)
  tradingview        7 tools  Stock scanning, quotes, technicals       (no key)
  tradingview-crypto 4 tools  Crypto pair scanning and technicals      (no key)
  sec-edgar          6 tools  SEC filings, insider trades, holdings    (no key)
  coingecko          3 tools  Crypto market data and trending          (no key)
  options            4 tools  Options chains, Greeks, unusual activity  (no key)
  options-cboe       1 tool   CBOE put/call ratio sentiment            (no key)
  finnhub            9 tools  Quotes, profiles, peers, news, earnings  (FINNHUB_API_KEY)
  alpha-vantage      5 tools  Stock quotes, fundamentals, dividends    (ALPHA_VANTAGE_API_KEY)
  fred               4 tools  Economic calendar, indicators, rates     (FRED_API_KEY)
```

Update total tool count to match (was 39 in help, actual is 43 + 4 = 47 after this module).

Also add `FRED_API_KEY` to the SETUP section env example.

### Step 2: Run full quality gates

Run: `npm run lint && npm test && npm run build`
Expected: ALL PASS

### Step 3: Manual smoke test (if FRED_API_KEY is set)

```bash
export FRED_API_KEY="your-key-here"
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"fred_economic_calendar","arguments":{}}}' | node dist/index.js
```

Expected: JSON response with upcoming economic release dates

### Step 4: Commit

```bash
git add src/index.ts
git commit -m "docs: update help text with fred module (#101)"
```

---

## Summary

| Task | Tool | Tests | Commits |
|------|------|-------|---------|
| 1 | Scaffold | 0 | 1 |
| 2 | `fred_economic_calendar` | 3 | 1 |
| 3 | `fred_indicator` | 3 | 1 |
| 4 | `fred_indicator_history` | 4 | 1 |
| 5 | `fred_search` | 2 | 1 |
| 6 | Help text + verification | 0 | 1 |
| **Total** | **4 tools** | **12 tests** | **6 commits** |

### API Key Note

FRED only supports query parameter auth (`?api_key=KEY`). This is a documented deviation from the project's "API keys in headers only" standard. The `shared/http.ts` `sanitizeUrl()` already redacts `api_key` from error messages, so key leakage in logs is handled.

### What This Unlocks

After this module ships, the LLM can answer "why is the market moving" by checking:
- `fred_economic_calendar` → "CPI releases tomorrow"
- `fred_indicator` with `fed_funds` → "Fed Funds at 3.75%"
- `fred_indicator_history` with `cpi` + `units=pc1` → "YoY inflation at 3.2%"
- `fred_search` → discover any FRED series by keyword
