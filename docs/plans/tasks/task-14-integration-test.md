# Task 14: Integration Test — Wire All 6 Modules into MCP Server

**Files:**
- Modify: `src/index.ts`
- Create: `src/__tests__/integration.test.ts`

---

**Step 1: Update `src/index.ts`**

Replace the entire contents of `src/index.ts` with the full entry point that imports and wires all 6 modules into the MCP server:

```typescript
#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { parseConfig } from "./config.js";
import { resolveEnabledModules } from "./registry.js";
import type { ModuleDefinition } from "./shared/types.js";
import { createTradingviewModule } from "./modules/tradingview/index.js";
import { createTradingviewCryptoModule } from "./modules/tradingview-crypto/index.js";
import { createSecEdgarModule } from "./modules/sec-edgar/index.js";
import { createCoingeckoModule } from "./modules/coingecko/index.js";
import { createFinnhubModule } from "./modules/finnhub/index.js";
import { createAlphaVantageModule } from "./modules/alpha-vantage/index.js";

function buildModules(env: Record<string, string | undefined>): ModuleDefinition[] {
  const modules: ModuleDefinition[] = [
    createTradingviewModule(),
    createTradingviewCryptoModule(),
    createSecEdgarModule(),
    createCoingeckoModule(),
  ];

  if (env.FINNHUB_API_KEY) {
    modules.push(createFinnhubModule(env.FINNHUB_API_KEY));
  }

  if (env.ALPHA_VANTAGE_API_KEY) {
    modules.push(createAlphaVantageModule(env.ALPHA_VANTAGE_API_KEY));
  }

  return modules;
}

async function main() {
  const config = parseConfig(process.argv.slice(2));
  const allModules = buildModules(config.env);
  const enabled = resolveEnabledModules(allModules, config.env, config.enabledModules);

  const server = new McpServer({
    name: "stock-scanner",
    version: "0.1.0",
  });

  for (const mod of enabled) {
    for (const tool of mod.tools) {
      server.registerTool(tool.name, {
        description: tool.description,
        inputSchema: tool.inputSchema,
      }, async (params) => {
        try {
          return await tool.handler(params as Record<string, unknown>);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: "text" as const, text: `Error: ${message}` }],
            isError: true,
          };
        }
      });
    }
    console.error(`Registered ${mod.tools.length} tools from ${mod.name}`);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `stock-scanner MCP server running -- ${enabled.length} modules, ` +
    `${enabled.reduce((n, m) => n + m.tools.length, 0)} tools`,
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
```

Key changes from the previous `src/index.ts`:
- Added imports for all 6 module factory functions (`createTradingviewModule`, `createTradingviewCryptoModule`, `createSecEdgarModule`, `createCoingeckoModule`, `createFinnhubModule`, `createAlphaVantageModule`).
- Added `buildModules()` function that instantiates the 4 free modules unconditionally and conditionally adds Finnhub and Alpha Vantage when their API keys are present.
- The `main()` function calls `buildModules()`, then `resolveEnabledModules()` to apply any `--modules` CLI filter.
- Each enabled module's tools are registered on the `McpServer` with a try/catch wrapper that converts thrown errors into MCP error responses.
- Startup log on stderr reports module and tool counts.

---

**Step 2: Write the integration test**

Create `src/__tests__/integration.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { parseConfig } from "../config.js";
import { resolveEnabledModules } from "../registry.js";
import { createTradingviewModule } from "../modules/tradingview/index.js";
import { createTradingviewCryptoModule } from "../modules/tradingview-crypto/index.js";
import { createSecEdgarModule } from "../modules/sec-edgar/index.js";
import { createCoingeckoModule } from "../modules/coingecko/index.js";
import { createFinnhubModule } from "../modules/finnhub/index.js";
import { createAlphaVantageModule } from "../modules/alpha-vantage/index.js";
import type { ModuleDefinition } from "../shared/types.js";

function buildAllModules(env: Record<string, string | undefined>): ModuleDefinition[] {
  const modules: ModuleDefinition[] = [
    createTradingviewModule(),
    createTradingviewCryptoModule(),
    createSecEdgarModule(),
    createCoingeckoModule(),
  ];
  if (env.FINNHUB_API_KEY) modules.push(createFinnhubModule(env.FINNHUB_API_KEY));
  if (env.ALPHA_VANTAGE_API_KEY) modules.push(createAlphaVantageModule(env.ALPHA_VANTAGE_API_KEY));
  return modules;
}

describe("full module wiring", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("enables 4 free modules with no API keys", () => {
    const modules = buildAllModules({});
    const enabled = resolveEnabledModules(modules, {});
    expect(enabled.map((m) => m.name)).toEqual([
      "tradingview", "tradingview-crypto", "sec-edgar", "coingecko",
    ]);
    const totalTools = enabled.reduce((n, m) => n + m.tools.length, 0);
    expect(totalTools).toBe(14); // 5 + 4 + 2 + 3
  });

  it("enables all 6 modules with all API keys", () => {
    const env = {
      FINNHUB_API_KEY: "test-finnhub-key",
      ALPHA_VANTAGE_API_KEY: "test-av-key",
    };
    const modules = buildAllModules(env);
    const enabled = resolveEnabledModules(modules, env);
    expect(enabled).toHaveLength(6);
    const totalTools = enabled.reduce((n, m) => n + m.tools.length, 0);
    expect(totalTools).toBe(19); // 5 + 4 + 2 + 3 + 2 + 3
  });

  it("all 19 tool names are unique", () => {
    const env = {
      FINNHUB_API_KEY: "key",
      ALPHA_VANTAGE_API_KEY: "key",
    };
    const modules = buildAllModules(env);
    const enabled = resolveEnabledModules(modules, env);
    const allNames = enabled.flatMap((m) => m.tools.map((t) => t.name));
    expect(new Set(allNames).size).toBe(19);
  });

  it("respects --modules filter", () => {
    const env = {
      FINNHUB_API_KEY: "key",
      ALPHA_VANTAGE_API_KEY: "key",
    };
    const modules = buildAllModules(env);
    const enabled = resolveEnabledModules(modules, env, ["tradingview", "finnhub"]);
    expect(enabled.map((m) => m.name)).toEqual(["tradingview", "finnhub"]);
  });

  it("every tool handler catches exceptions", async () => {
    const env = { FINNHUB_API_KEY: "key", ALPHA_VANTAGE_API_KEY: "key" };
    const modules = buildAllModules(env);
    const enabled = resolveEnabledModules(modules, env);

    // Stub fetch to fail for all tools
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    for (const mod of enabled) {
      for (const tool of mod.tools) {
        const result = await tool.handler({});
        // Every handler should catch and return errorResult, not throw
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Error:");
      }
    }

    vi.restoreAllMocks();
  });

  it("config parses CLI args correctly", () => {
    const config = parseConfig(["--modules", "tradingview,finnhub", "--default-exchange", "NYSE"]);
    expect(config.enabledModules).toEqual(["tradingview", "finnhub"]);
    expect(config.defaultExchange).toBe("NYSE");
  });
});
```

This test file covers the following scenarios:
- **4 free modules enabled by default** — verifies that TradingView, TradingView Crypto, SEC EDGAR, and CoinGecko load without any API keys, and the total tool count is 14 (5 + 4 + 2 + 3).
- **All 6 modules enabled** — verifies that providing both `FINNHUB_API_KEY` and `ALPHA_VANTAGE_API_KEY` enables all 6 modules with a total of 19 tools (14 + 2 + 3).
- **Tool name uniqueness** — confirms all 19 tool names across all modules are unique (no collisions between module prefixes).
- **`--modules` CLI filter** — verifies that `resolveEnabledModules` correctly filters to only the requested modules.
- **Error handling** — stubs `fetch` to reject, then calls every single tool handler with empty params and asserts each returns `{ isError: true }` with an error message (never throws).
- **CLI config parsing** — verifies `parseConfig` correctly extracts `--modules` and `--default-exchange` from argv.

---

**Step 3: Build and verify**

Run:
```bash
npm run build
```

Expected: No TypeScript compilation errors. The `dist/` directory contains the compiled `index.js` with all 6 module imports resolved.

---

**Step 4: Run all tests**

Run:
```bash
npx vitest run
```

Expected: ALL tests pass, including the new integration tests alongside existing unit tests for each module. The test output should show the `full module wiring` suite with 6 passing tests.

---

**Step 5: Smoke test**

Run:
```bash
echo '{}' | timeout 3 node dist/index.js 2>&1 || true
```

Expected: stderr output includes:
```
Registered 5 tools from tradingview
Registered 4 tools from tradingview-crypto
Registered 2 tools from sec-edgar
Registered 3 tools from coingecko
stock-scanner MCP server running -- 4 modules, 14 tools
```

This confirms the server starts, registers only the 4 free modules (no API keys set), and reports the correct counts.

---

**Step 6: Commit**

```bash
git add src/index.ts src/__tests__/integration.test.ts
git commit -m "feat: wire all 6 modules into server and add integration tests"
```
