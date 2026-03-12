# Task 10: SEC EDGAR Module

**Files:**
- Create: `src/modules/sec-edgar/client.ts`
- Create: `src/modules/sec-edgar/index.ts`
- Test: `src/modules/sec-edgar/__tests__/client.test.ts`

---

**Step 1: Write the test**

Create `src/modules/sec-edgar/__tests__/client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchFilings, getCompanyFilings } from "../client.js";

describe("searchFilings", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends GET with User-Agent and query params", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        hits: {
          hits: [
            {
              _id: "0001234567-24-000001",
              _source: {
                file_num: "001-12345",
                file_date: "2024-03-15",
                form_type: "10-K",
                entity_name: "Apple Inc",
                tickers: "AAPL",
                display_names: ["Apple Inc"],
                file_description: "Annual report",
              },
            },
          ],
        },
      }),
    });

    const filings = await searchFilings({ query: "artificial intelligence" });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("efts.sec.gov"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "User-Agent": expect.stringContaining("stock-scanner-mcp"),
        }),
      }),
    );
    expect(filings).toHaveLength(1);
    expect(filings[0].formType).toBe("10-K");
    expect(filings[0].entityName).toBe("Apple Inc");
    expect(filings[0].accessionNumber).toBe("0001234567-24-000001");
  });

  it("passes form filter in query string", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ hits: { hits: [] } }),
    });

    await searchFilings({ query: "revenue", forms: ["10-K", "10-Q"] });

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).toContain("forms=10-K%2C10-Q");
  });

  it("respects limit parameter", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ hits: { hits: [] } }),
    });

    await searchFilings({ query: "test", limit: 5 });

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).toContain("size=5");
  });
});

describe("getCompanyFilings", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("searches by ticker", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ hits: { hits: [] } }),
    });

    await getCompanyFilings({ ticker: "AAPL" });

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).toContain("tickers=AAPL");
  });
});

describe("createSecEdgarModule", () => {
  it("returns module with 2 tools and no required env vars", async () => {
    const { createSecEdgarModule } = await import("../index.js");
    const mod = createSecEdgarModule();
    expect(mod.name).toBe("sec-edgar");
    expect(mod.requiredEnvVars).toEqual([]);
    expect(mod.tools).toHaveLength(2);
    expect(mod.tools.map((t) => t.name)).toEqual(["edgar_search", "edgar_company_filings"]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/sec-edgar/__tests__/client.test.ts`
Expected: FAIL (client.ts and index.ts do not exist yet)

**Step 3: Write the implementation**

Create `src/modules/sec-edgar/client.ts`:

```typescript
import { httpGet } from "../../shared/http.js";
import { TtlCache } from "../../shared/cache.js";

const EFTS_BASE = "https://efts.sec.gov/LATEST/search-index";
const USER_AGENT = "stock-scanner-mcp/0.1.0 (https://github.com/stock-scanner-mcp)";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const cache = new TtlCache<unknown>(CACHE_TTL);

export interface EdgarSearchParams {
  query: string;
  dateRange?: string;       // e.g. "2024-01-01,2024-12-31"
  forms?: string[];         // e.g. ["10-K", "10-Q"]
  tickers?: string[];
  limit?: number;
}

export interface EdgarFiling {
  accessionNumber: string;
  filedAt: string;
  formType: string;
  entityName: string;
  ticker: string;
  description: string;
  documentUrl: string;
}

export async function searchFilings(params: EdgarSearchParams): Promise<EdgarFiling[]> {
  const searchParams = new URLSearchParams();
  searchParams.set("q", params.query);
  searchParams.set("dateRange", params.dateRange ?? "");
  if (params.forms?.length) searchParams.set("forms", params.forms.join(","));
  if (params.tickers?.length) searchParams.set("tickers", params.tickers.join(","));
  searchParams.set("from", "0");
  searchParams.set("size", String(params.limit ?? 20));

  const url = `${EFTS_BASE}?${searchParams.toString()}`;
  const cacheKey = url;

  const cached = cache.get(cacheKey);
  if (cached) return cached as EdgarFiling[];

  const response = await httpGet<{
    hits: {
      hits: Array<{
        _source: {
          file_num: string;
          file_date: string;
          form_type: string;
          entity_name: string;
          tickers: string;
          display_names: string[];
          file_description: string;
        };
        _id: string;
      }>;
    };
  }>(url, {
    headers: { "User-Agent": USER_AGENT },
  });

  const filings: EdgarFiling[] = response.hits.hits.map((hit) => ({
    accessionNumber: hit._id,
    filedAt: hit._source.file_date,
    formType: hit._source.form_type,
    entityName: hit._source.entity_name,
    ticker: hit._source.tickers ?? "",
    description: hit._source.file_description ?? "",
    documentUrl: `https://www.sec.gov/Archives/edgar/data/${hit._id.replace(/-/g, "").slice(0, 10)}/${hit._id}.txt`,
  }));

  cache.set(cacheKey, filings);
  return filings;
}

export interface CompanyFilingsParams {
  ticker: string;
  forms?: string[];
  limit?: number;
}

export async function getCompanyFilings(params: CompanyFilingsParams): Promise<EdgarFiling[]> {
  return searchFilings({
    query: "*",
    tickers: [params.ticker],
    forms: params.forms,
    limit: params.limit,
  });
}
```

Create `src/modules/sec-edgar/index.ts`:

```typescript
import { z } from "zod";
import type { ModuleDefinition, ToolDefinition } from "../../shared/types.js";
import { successResult, errorResult } from "../../shared/types.js";
import { searchFilings, getCompanyFilings } from "./client.js";

const searchTool: ToolDefinition = {
  name: "edgar_search",
  description: "Search SEC EDGAR filings by keyword. Returns accession numbers, filing dates, form types, and entity names. Rate limit: 10 requests/second.",
  inputSchema: {
    query: z.string().describe("Search query (e.g. 'artificial intelligence', 'revenue growth')"),
    dateRange: z.string().optional().describe("Date range as 'YYYY-MM-DD,YYYY-MM-DD'"),
    forms: z.array(z.string()).optional().describe("Form types to filter (e.g. ['10-K', '10-Q', '8-K'])"),
    tickers: z.array(z.string()).optional().describe("Company tickers to filter (e.g. ['AAPL', 'MSFT'])"),
    limit: z.number().optional().describe("Max results (default: 20, max: 50)"),
  },
  handler: async (params) => {
    try {
      const filings = await searchFilings({
        query: params.query as string,
        dateRange: params.dateRange as string | undefined,
        forms: params.forms as string[] | undefined,
        tickers: params.tickers as string[] | undefined,
        limit: Math.min((params.limit as number) ?? 20, 50),
      });
      return successResult(JSON.stringify(filings, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

const companyFilingsTool: ToolDefinition = {
  name: "edgar_company_filings",
  description: "Get recent SEC filings for a specific company by ticker symbol.",
  inputSchema: {
    ticker: z.string().describe("Company ticker symbol (e.g. 'AAPL')"),
    forms: z.array(z.string()).optional().describe("Form types (e.g. ['10-K', '10-Q']). Default: all."),
    limit: z.number().optional().describe("Max results (default: 10, max: 50)"),
  },
  handler: async (params) => {
    try {
      const filings = await getCompanyFilings({
        ticker: params.ticker as string,
        forms: params.forms as string[] | undefined,
        limit: Math.min((params.limit as number) ?? 10, 50),
      });
      return successResult(JSON.stringify(filings, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

export function createSecEdgarModule(): ModuleDefinition {
  return {
    name: "sec-edgar",
    description: "SEC EDGAR filing search -- full-text search and company filing lookup via EFTS",
    requiredEnvVars: [],
    tools: [searchTool, companyFilingsTool],
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/modules/sec-edgar/__tests__/client.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/modules/sec-edgar/client.ts src/modules/sec-edgar/index.ts src/modules/sec-edgar/__tests__/client.test.ts
git commit -m "feat: add SEC EDGAR module with full-text search and company filing lookup"
```
