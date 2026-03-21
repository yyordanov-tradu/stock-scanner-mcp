# Development Standards

**Authoritative reference for architecture, patterns, and best practices.**
All contributors (human and LLM) MUST follow these standards. Deviations require explicit approval.

---

## 1. Architecture

### Module System

The project is a modular MCP server. Each data source is a self-contained **module**.

```
User → Claude Code → LLM → MCP Server (index.ts)
                              ↓
                         registry.ts → resolveEnabledModules()
                              ↓
                    ┌─────────┼─────────┐
                    ▼         ▼         ▼
               module A   module B   module C
               (tools)    (tools)    (tools)
                    │         │         │
                    ▼         ▼         ▼
              External APIs (Finnhub, TradingView, etc.)
```

### Module Lifecycle

1. `buildAllModules(env)` in `index.ts` instantiates all modules via factory functions
2. `resolveEnabledModules()` in `registry.ts` filters by env vars and `--modules` CLI flag
3. Each enabled module's tools are registered on the MCP server
4. Tool calls flow: MCP request → tool handler → client function → HTTP → external API

---

## 2. Module Structure

### Directory Layout

Every module MUST follow this structure:

```
src/modules/{module-name}/
├── index.ts              # REQUIRED: exports create{ModuleName}Module() factory
├── client.ts             # REQUIRED: HTTP client functions with caching
├── {other}.ts            # OPTIONAL: supporting logic (greeks.ts, yahoo-session.ts)
└── __tests__/
    ├── client.test.ts    # REQUIRED: unit tests for every client function
    └── {other}.test.ts   # OPTIONAL: tests for supporting logic
```

### Factory Function Pattern

Every module MUST export a single factory function:

```typescript
// src/modules/{name}/index.ts
export function create{Name}Module(apiKey?: string): ModuleDefinition {
  const metadata = { source: "{name}", dataDelay: "real-time" | "15min" | "end-of-day" };

  const someTool: ToolDefinition = {
    name: "{module}_{action}",        // MUST follow naming convention
    description: "...",                // MUST be LLM-readable (see Tool Descriptions)
    inputSchema: z.object({ ... }),    // MUST use zod
    handler: withMetadata(async (params) => {
      // ... call client function
      return successResult(JSON.stringify(data, null, 2));
    }, metadata),
  };

  return {
    name: "{module-name}",
    description: "...",
    requiredEnvVars: ["ENV_VAR_NAME"],  // empty array if no key needed
    tools: [someTool, ...],
  };
}
```

### Client Function Pattern

Every API-calling function MUST follow this pattern:

```typescript
// src/modules/{name}/client.ts
import { httpGet } from "../../shared/http.js";
import { TtlCache } from "../../shared/cache.js";

const BASE_URL = "https://api.example.com";
const CACHE_TTL = 5 * 60 * 1000;  // 5 minutes (adjust per data freshness needs)
const cache = new TtlCache<unknown>(CACHE_TTL);

export interface ResponseType { /* typed fields */ }

export async function getSomething(
  apiKey: string,
  symbol: string,
): Promise<ResponseType> {
  const cacheKey = `something:${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as ResponseType;

  const data = await httpGet<ResponseType>(
    `${BASE_URL}/endpoint?symbol=${encodeURIComponent(symbol)}`,
    { headers: { "X-Api-Token": apiKey } },
  );

  cache.set(cacheKey, data);
  return data;
}
```

**Rules:**
- Every response type MUST have a TypeScript interface (no `any` except legacy code)
- Every URL parameter MUST use `encodeURIComponent()`
- Every function MUST check cache before HTTP call
- API keys SHOULD be passed via headers; URL query param auth is allowed when the external API requires it (see Documented Deviations below)
- Cache keys MUST be unique and include all varying parameters

**Documented Deviations:** If an external API does not support header-based auth (e.g., FRED requires `?api_key=`), this is allowed but MUST be:
1. Documented in the PR description
2. Noted in the module's `client.ts` with a comment explaining why
3. Verified that `shared/http.ts` `sanitizeUrl()` redacts the key from error messages

---

## 3. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Module directory | kebab-case | `alpha-vantage/`, `sec-edgar/` |
| Module factory | PascalCase with `create` prefix | `createFinnhubModule()` |
| Tool name | `{module}_{action}` snake_case | `finnhub_quote`, `options_chain` |
| Client function | camelCase with `get`/`fetch` prefix | `getQuote()`, `getCompanyProfile()` |
| Interface | PascalCase, descriptive | `CompanyProfile`, `MarketStatus` |
| Cache key | `{entity}:{params}` colon-separated | `quote:AAPL`, `news:general:20` |
| Test file | mirrors source file name | `client.ts` → `client.test.ts` |
| Env var | UPPER_SNAKE_CASE | `FINNHUB_API_KEY` |

---

## 4. Tool Descriptions

Tool descriptions are consumed by LLMs to decide which tool to call. They MUST be:

1. **Self-contained** — describe what the tool returns, not just what it does
2. **Disambiguated** — if multiple tools return similar data, explain the difference
3. **Specific about defaults** — mention default values for optional params
4. **Honest about limitations** — mention API key requirements, data delays, rate limits

5. **Scale/range documented** — if a field returns a rating, score, or non-obvious numeric range, state the scale (e.g., "recommendation rating from -1 (strong sell) to +1 (strong buy)")

**Good:**
```
"Get a real-time stock quote from Finnhub (requires API key): current price, change,
percent change, day high/low, open, and previous close. Use tradingview_quote for a
keyless alternative."
```

```
"Returns analyst recommendation rating (-1 sell to +1 buy) and RSI (0-100)."
```

**Bad:**
```
"Get stock quote."
```

```
"Returns analyst recommendation."  // What scale? What do values mean?
```

### Schema Defaults

When a parameter has a default value, declare it in the zod schema using `.default()` so it appears in the JSON schema:

```typescript
// GOOD — default visible to LLM
exchange: z.string().default("US").describe("Exchange code")

// BAD — default hidden from LLM
exchange: z.string().optional().describe("Exchange code (default: 'US')")
// with manual: const exchange = (params.exchange as string) || "US";
```

---

## 5. Error Handling

Three layers of error handling — every layer MUST be present:

### Layer 1: Client Functions (API-specific)

Detect and throw meaningful errors for known API error shapes:

```typescript
// Alpha Vantage returns errors as JSON fields
if (data["Error Message"]) throw new Error(`Alpha Vantage Error: ${data["Error Message"]}`);
if (data["Note"]) throw new Error(`Alpha Vantage Rate Limit: ${data["Note"]}`);
```

#### Defensive Array Access

When external APIs return arrays (e.g., `seriess`, `observations`, `results`), ALWAYS guard against empty arrays before accessing `[0]`. Throw a descriptive error instead of letting a `TypeError` bubble up through `withMetadata()` with a cryptic message:

```typescript
// GOOD — descriptive error
const series = data.seriess[0];
if (!series) throw new Error(`Series not found: ${seriesId}`);

// BAD — cryptic TypeError if array is empty
const s = data.seriess[0];
return { id: s.id, title: s.title }; // TypeError: Cannot read properties of undefined
```

### Layer 2: `withMetadata()` Wrapper (standardized)

All tool handlers MUST be wrapped with `withMetadata()`. It:
- Catches all errors and returns structured JSON: `{ error: true, code, message, retryable }`
- Maps HTTP status codes to error codes (429 → `RATE_LIMITED`, 403 → `FORBIDDEN`)
- Injects `_meta` with `lastUpdated`, `source`, `dataDelay`

### Layer 3: Server Registration (catch-all)

`index.ts` wraps every registered handler in a final try/catch. This is the safety net.

**Rule:** Tool handlers MUST NEVER throw unhandled exceptions to the MCP client.

### Response Shape Consistency

All tool handlers within a module MUST return the same response shape. The standard shape is `JSON.stringify(data, null, 2)` where `data` is the typed array or object returned by the client function. Do NOT invent custom wrapper objects (e.g. `{ tickers, metrics, data }`) — this forces LLMs to handle multiple response formats from the same module.

If a tool needs a genuinely different shape, document it in the tool description and add a test verifying the shape.

### Metadata Columns

When a tool returns data about stocks/instruments, ALWAYS include both `name` (short identifier) and `description` (full company name) columns. Users and LLMs need the human-readable name for context. Check existing tools in the same module for the standard set of metadata columns and match them.

---

## 6. HTTP Client

All HTTP calls MUST go through `shared/http.ts`. Direct `fetch()` calls are prohibited.

| Rule | Value |
|------|-------|
| Timeout | 10 seconds (default) via AbortController |
| API keys in URLs | Sanitized in error messages via regex |
| Methods | `httpGet<T>()` and `httpPost<T>()` only |
| Response | Parsed as JSON; typed via generic parameter |

---

## 7. Caching

| Rule | Detail |
|------|--------|
| Implementation | `TtlCache` from `shared/cache.ts` |
| Scope | One cache instance per module (module-level `const`) |
| TTL | 5 minutes default; shorter for real-time data (quotes) |
| Key format | `{entity}:{param1}:{param2}` colon-separated |
| Utility | Use `cache.getOrFetch(key, fetcher)` when possible |

---

## 8. Testing Standards

### Mandatory Coverage

- **Every new client function** MUST have at least one unit test
- **Every modified function** MUST have its tests updated if behavior changed
- **Every module** MUST have a test verifying tool count and tool names
- **Every new tool handler** MUST have a dedicated test that verifies:
  1. Correct columns/parameters sent to the underlying API call
  2. Input resolution (e.g., ticker resolution from simple → exchange-qualified)
  3. Response structure matches expected shape
- **Schema validation edge cases** MUST be tested when zod constraints are non-trivial (e.g., `.min(2).max(5)` on an array — test both below-min and above-max inputs)
- **Partial data** — test behavior when some items return data and others don't (e.g., 1 of 3 tickers not found)
- **Integration tests** (`src/__tests__/integration.test.ts`) MUST be updated when tool counts change

### Test Structure

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("functionName", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("describes expected behavior", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    const result = await functionUnderTest("api-key", "AAPL");

    // Verify URL construction (use the actual header name for the module, e.g. "X-Finnhub-Token")
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("expected/url?symbol=AAPL"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Finnhub-Token": "api-key",
        }),
      }),
    );
    // Verify result shape
    expect(result.field).toBe(expectedValue);
  });
});
```

### What to Test

| Category | Tests |
|----------|-------|
| Happy path | Correct URL, headers, parsed response |
| Edge cases | Empty arrays, null fields, unknown symbols |
| Invalid input | Empty API response arrays, unknown IDs, series/symbol not found |
| Caching | Use `vi.useFakeTimers()` for TTL behavior |
| Error handling | Non-ok responses, network failures, rate limits |
| Module wiring | Tool count, tool names, required env vars |

### Test Commands

```bash
npm test              # Run all tests once
npm run test:watch    # Watch mode during development
```

---

## 9. Shared Utilities

| Utility | Location | Purpose |
|---------|----------|---------|
| `httpGet<T>()` / `httpPost<T>()` | `shared/http.ts` | All external HTTP calls |
| `TtlCache<T>` | `shared/cache.ts` | In-memory TTL caching |
| `successResult()` / `errorResult()` | `shared/types.ts` | ToolResult builders |
| `withMetadata()` | `shared/utils.ts` | Error handling + metadata injection |
| `resolveTicker()` | `shared/resolver.ts` | Ticker normalization (e.g., `AAPL` → `{ ticker: "AAPL", exchange: "NASDAQ" }`) |

**Rule:** Before adding a new utility, check if an existing one covers the use case. Do not duplicate functionality.

---

## 10. Build & Distribution

| Aspect | Detail |
|--------|--------|
| Build tool | tsup (not tsc directly) |
| Format | ESM only (`"type": "module"` in package.json) |
| Entry | `src/index.ts` → `dist/index.js` |
| Imports | MUST use `.js` extension (e.g., `from "./client.js"`) |
| Target | ES2022 |
| Type checking | `npm run lint` (tsc --noEmit) |
| Pre-publish | `npm run build && npm test` (automatic via `prepublishOnly`) |

---

## 11. Adding a New Module — Checklist

1. Create directory: `src/modules/{name}/`
2. Create `client.ts` with typed interfaces and cached HTTP functions
3. Create `index.ts` with `create{Name}Module()` factory
4. Create `__tests__/client.test.ts` with tests for every client function
5. Register in `index.ts` → `buildAllModules()` (conditionally if needs API key)
6. Add env var to `src/config.ts` → `parseConfig()` if module requires an API key
7. Update integration test tool counts in `src/__tests__/integration.test.ts`
8. Update `CLAUDE.md` module table
9. Update help text in `src/index.ts` (MODULES section)

---

## 12. Adding a New Tool to an Existing Module — Checklist

1. Add the tool definition in the module's `index.ts` (follow naming: `{module}_{action}`)
2. Include both `name` and `description` metadata columns if tool returns stock/instrument data
3. Use the same response shape as other tools in the module (usually `JSON.stringify(rows, null, 2)`)
4. Write an LLM-friendly tool description — include value scales, limitations, and disambiguation from similar tools
5. Add a **dedicated handler test** in the module's `__tests__/` directory (e.g. `client.test.ts`) verifying columns, input resolution, and response shape
6. Add **edge case tests** for any non-trivial schema constraints (min/max array length, etc.)
7. Update tool count assertions in the module test (`mod.tools.toHaveLength(N)`) and tool name list
8. Update integration test tool counts in `src/__tests__/integration.test.ts`

---

## 13. Code Quality Gates

Before any PR is merged:

```bash
npm run lint            # TypeScript type checking — must pass
npm test                # All tests — must pass
npm run validate-tools  # Tool description quality — must pass
npm run build           # Build — must succeed
```

All four MUST pass. No exceptions.

### Tool Description Validation

`npm run validate-tools` checks every MCP tool definition for:

1. **Description quality** — minimum 50 chars, mentions data source (or tool name implies it)
2. **Schema quality** — every zod parameter has `.describe()`
3. **Structural consistency** — tool names follow `{module}_{action}` prefix convention, no duplicates
4. **Value-scale documentation** — tools returning recommendations/ratings document the scale

Runs in CI alongside lint and test. See `src/scripts/validate-tools.ts` for implementation.

### Code Hygiene

Before committing:
- **No dead code** — remove unused functions, variables, and constants. If code is written but never called, delete it.
- **No hardcoded counts in tests** — use dynamic checks or regex patterns instead of literal values (e.g., `expect(result).toMatch(/All \d+ tools/)` instead of `expect(result).toContain("All 47 tools")`). Hardcoded counts break every time a tool is added.
- **Specific `git add`** — add files by name, not `git add -A` or `git add .`. Broad adds risk committing IDE config, local artifacts, or generated files.
- **Check `.gitignore`** — before committing new file types (scripts, wiki drafts, config), verify `.gitignore` excludes local-only artifacts (`.idea/`, `wiki/`, `*.lock` files from tools).

### Documentation Freshness

Every code change MUST check whether `CLAUDE.md` or files it references need updating. Common triggers:

- **New module** → update module count, tool count, project structure tree, module table, env vars
- **New/removed tool** → update tool count
- **New env var** → add to Configuration section
- **Version bump** → update version in Status section
- **New shared utility** → check if `development-standards.md` §9 needs a row
- **Changed conventions** → update both `development-standards.md` (detailed) and `CLAUDE.md` (summary)

**Rule:** If your PR changes behavior documented in `CLAUDE.md` or `docs/development-standards.md`, update those files in the same PR. Stale docs mislead both human and LLM contributors.
