# Finnhub Economic Calendar Tool

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `finnhub_economic_calendar` tool to the existing Finnhub module. Surfaces FOMC decisions, CPI, GDP, NFP, and other macro releases with actual/estimate/previous values and impact ratings. No new API keys — uses the existing `FINNHUB_API_KEY`.

**Architecture:** Add one client function (`getEconomicCalendar`) and one tool definition to the existing Finnhub module. Follows the same patterns as `getEarningsCalendar`. Endpoint: `GET /calendar/economic?from=YYYY-MM-DD&to=YYYY-MM-DD`.

**Tech Stack:** TypeScript, Finnhub REST API, zod, vitest

---

### Task 1: Add Client Function

**Files:**
- Modify: `src/modules/finnhub/client.ts`
- Modify: `src/modules/finnhub/__tests__/client.test.ts`

**Step 1: Write failing test for getEconomicCalendar**

Add to `src/modules/finnhub/__tests__/client.test.ts`:

```typescript
describe("getEconomicCalendar", () => {
  it("fetches and caches economic events", async () => {
    const mockEvents = [
      {
        country: "US",
        event: "FOMC Interest Rate Decision",
        actual: 5.5,
        estimate: 5.5,
        prev: 5.25,
        impact: "high",
        time: "14:00:00",
        unit: "%",
      },
      {
        country: "US",
        event: "CPI YoY",
        actual: 3.2,
        estimate: 3.3,
        prev: 3.0,
        impact: "high",
        time: "08:30:00",
        unit: "%",
      },
    ];

    mockHttpGet.mockResolvedValueOnce({
      economicCalendar: mockEvents,
    });

    const { getEconomicCalendar } = await import("../client.js");
    const result = await getEconomicCalendar("test-key", "2026-03-10", "2026-03-17");

    expect(result).toHaveLength(2);
    expect(result[0].event).toBe("FOMC Interest Rate Decision");
    expect(result[0].impact).toBe("high");
    expect(result[0].actual).toBe(5.5);
    expect(result[0].country).toBe("US");

    // Verify API call
    expect(mockHttpGet).toHaveBeenCalledWith(
      expect.stringContaining("/calendar/economic?from=2026-03-10&to=2026-03-17"),
      expect.objectContaining({
        headers: { "X-Finnhub-Token": "test-key" },
      }),
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/modules/finnhub/__tests__/client.test.ts`
Expected: FAIL — `getEconomicCalendar` not exported.

**Step 3: Add the interface and client function**

Add to `src/modules/finnhub/client.ts`, after the `PriceTarget` block and before `getShortInterest`:

```typescript
export interface EconomicEvent {
  country: string;
  event: string;
  actual: number | null;
  estimate: number | null;
  prev: number | null;
  impact: string;
  time: string;
  unit: string;
}

export async function getEconomicCalendar(
  apiKey: string,
  from: string,
  to: string,
): Promise<EconomicEvent[]> {
  const cacheKey = `economic:${from}:${to}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as EconomicEvent[];

  const data = await httpGet<{ economicCalendar: EconomicEvent[] }>(
    `${BASE_URL}/calendar/economic?from=${from}&to=${to}`,
    { headers: { "X-Finnhub-Token": apiKey } },
  );

  const result = data.economicCalendar ?? [];
  cache.set(cacheKey, result);
  return result;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/modules/finnhub/__tests__/client.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/modules/finnhub/client.ts src/modules/finnhub/__tests__/client.test.ts
git commit -m "feat(finnhub): add getEconomicCalendar client function"
```

---

### Task 2: Add Tool Definition

**Files:**
- Modify: `src/modules/finnhub/index.ts`

**Step 1: Import getEconomicCalendar**

In `src/modules/finnhub/index.ts`, add `getEconomicCalendar` to the existing import from `./client.js`.

> **CRITICAL:** Do NOT replace the entire import block. The existing imports include `getShortInterest` — you must preserve it. Only ADD `getEconomicCalendar` to the list.

```typescript
import {
  getMarketNews,
  getCompanyNews,
  getEarningsCalendar,
  getAnalystRecommendations,
  getPriceTarget,
  getShortInterest,       // ← MUST keep — do NOT remove
  getEconomicCalendar,    // ← ADD this
} from "./client.js";
```

**Step 2: Add the tool definition**

Add after `shortInterestTool` (before the `return` statement):

```typescript
const economicCalendarTool = {
  name: "finnhub_economic_calendar",
  description:
    "Get upcoming and recent economic events (FOMC, CPI, GDP, NFP, etc.) with actual/estimate/previous values and impact ratings. Essential for understanding macro catalysts that move markets, crypto, and correlated assets.",
  inputSchema: z.object({
    from: z.string().describe("Start date (YYYY-MM-DD)"),
    to: z.string().describe("End date (YYYY-MM-DD)"),
    country: z.string().optional().describe("Filter by country code (e.g. 'US', 'EU', 'GB'). Default: all countries"),
    impact: z.string().optional().describe("Filter by impact: 'high', 'medium', 'low'. Default: all"),
    limit: z.number().optional().describe("Max results (default: 50, max: 200)"),
  }),
  handler: withMetadata(async (params) => {
    const events = await getEconomicCalendar(
      apiKey,
      params.from as string,
      params.to as string,
    );

    let filtered = events;

    if (params.country) {
      const country = (params.country as string).toUpperCase();
      filtered = filtered.filter(e => e.country === country);
    }

    if (params.impact) {
      const impact = (params.impact as string).toLowerCase();
      filtered = filtered.filter(e => e.impact === impact);
    }

    const limit = Math.min((params.limit as number) ?? 50, 200);
    const capped = filtered.slice(0, limit);

    return successResult(JSON.stringify(capped, null, 2));
  }, metadata),
};
```

**Step 3: Add to tools array**

> **CRITICAL:** Do NOT replace the entire tools array. The existing array includes `shortInterestTool` — you must preserve it. Only ADD `economicCalendarTool` to the end.

Update the return statement's `tools` array to include the new tool:

```typescript
tools: [
  marketNewsTool,
  companyNewsTool,
  earningsCalendarTool,
  analystRatingsTool,
  shortInterestTool,        // ← MUST keep — do NOT remove
  economicCalendarTool,     // ← ADD this
],
```

**Step 4: Run type check and tests**

Run: `npm run lint && npm test`
Expected: All pass.

**Step 5: Commit**

```bash
git add src/modules/finnhub/index.ts
git commit -m "feat(finnhub): add finnhub_economic_calendar tool"
```

---

### Task 3: Update Test Counts

**Files:**
- Modify: `src/__tests__/integration.test.ts`
- Modify: `src/modules/finnhub/__tests__/client.test.ts`

**Step 1: Update module-level test count in `client.test.ts`**

In `src/modules/finnhub/__tests__/client.test.ts`, find the `createFinnhubModule` test. Update the expected tool count and tool names list:

- Tool count: current value → current value + 1 (adding `finnhub_economic_calendar`)
- Tool names array: add `"finnhub_economic_calendar"` after `"finnhub_short_interest"`

> **Note:** Read the file first to get the current count. At time of writing it is 5 → 6, but verify before editing.

**Step 2: Update integration test counts in `integration.test.ts`**

In `src/__tests__/integration.test.ts`, update both tool count assertions:

- Total tools assertion: current value → current value + 1
- Unique names assertion: current value → current value + 1

> **Note:** Read the file first to get the current count. At time of writing it is 30 → 31, but verify before editing. Also update the comment showing the per-module breakdown (finnhub goes from 5 to 6).

**Step 3: Run full test suite**

Run: `npm run lint && npm test`
Expected: All pass.

**Step 4: Commit**

```bash
git add src/__tests__/integration.test.ts src/modules/finnhub/__tests__/client.test.ts
git commit -m "test: update tool counts for economic calendar (finnhub 5→6)"
```

---

## Finnhub API Reference

**Endpoint:** `GET https://finnhub.io/api/v1/calendar/economic`

**Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| from | string | Yes | Start date (YYYY-MM-DD) |
| to | string | Yes | End date (YYYY-MM-DD) |

**Response shape:**
```json
{
  "economicCalendar": [
    {
      "country": "US",
      "event": "FOMC Interest Rate Decision",
      "actual": 5.5,
      "estimate": 5.5,
      "prev": 5.25,
      "impact": "high",
      "time": "14:00:00",
      "unit": "%"
    }
  ]
}
```

**Rate limit:** Shares the 60 calls/minute free tier with other Finnhub endpoints.
