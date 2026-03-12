# Task 4: HTTP Client

**Files:**
- Create: `src/shared/http.ts`
- Test: `src/shared/__tests__/http.test.ts`

---

**Step 1: Write the test**

Create `src/shared/__tests__/http.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { httpPost, httpGet } from "../http.js";

describe("httpPost", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends POST with JSON body and returns parsed JSON", async () => {
    const mockResponse = { data: [{ s: "AAPL", d: [1, 2, 3] }] };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await httpPost("https://scanner.tradingview.com/america/scan", {
      symbols: { tickers: ["NASDAQ:AAPL"] },
      columns: ["close"],
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://scanner.tradingview.com/america/scan",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(result).toEqual(mockResponse);
  });

  it("throws on non-OK response", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      text: async () => "rate limited",
    });

    await expect(
      httpPost("https://example.com/api", {}),
    ).rejects.toThrow("HTTP 429");
  });

  it("throws on timeout", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((_, reject) =>
        setTimeout(() => reject(new DOMException("aborted", "AbortError")), 100),
      ),
    );

    await expect(
      httpPost("https://example.com/api", {}, { timeoutMs: 50 }),
    ).rejects.toThrow();
  });
});

describe("httpGet", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends GET and returns parsed JSON", async () => {
    const mockResponse = { quote: { c: 150.5 } };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await httpGet("https://finnhub.io/api/v1/quote?symbol=AAPL");
    expect(result).toEqual(mockResponse);
  });

  it("passes custom headers", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await httpGet("https://example.com", { headers: { "X-Token": "abc" } });

    expect(fetch).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({
        headers: { "X-Token": "abc" },
      }),
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/__tests__/http.test.ts`
Expected: FAIL -- module not found

**Step 3: Write the HTTP client**

Create `src/shared/http.ts`:

```typescript
export interface HttpOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
}

const DEFAULT_TIMEOUT_MS = 10_000;

export async function httpPost<T = unknown>(
  url: string,
  body: unknown,
  options: HttpOptions = {},
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, headers = {} } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `HTTP ${response.status}: ${response.statusText} -- ${text.slice(0, 200)}`,
      );
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function httpGet<T = unknown>(
  url: string,
  options: HttpOptions = {},
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, headers = {} } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `HTTP ${response.status}: ${response.statusText} -- ${text.slice(0, 200)}`,
      );
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/__tests__/http.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/http.ts src/shared/__tests__/http.test.ts
git commit -m "feat: add HTTP client with timeouts for POST and GET"
```
