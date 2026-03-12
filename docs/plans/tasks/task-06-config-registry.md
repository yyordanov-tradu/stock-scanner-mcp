# Task 6: Config & Module Registry

**Files:**
- Create: `src/config.ts`
- Create: `src/registry.ts`
- Test: `src/__tests__/config.test.ts`
- Test: `src/__tests__/registry.test.ts`

---

**Step 1: Write config test**

Create `src/__tests__/config.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { parseConfig } from "../config.js";

describe("parseConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns defaults with no args", () => {
    const config = parseConfig([]);
    expect(config.defaultExchange).toBe("NASDAQ");
    expect(config.enabledModules).toBeUndefined();
  });

  it("parses --modules flag", () => {
    const config = parseConfig(["--modules", "tradingview,finnhub"]);
    expect(config.enabledModules).toEqual(["tradingview", "finnhub"]);
  });

  it("parses --default-exchange flag", () => {
    const config = parseConfig(["--default-exchange", "NYSE"]);
    expect(config.defaultExchange).toBe("NYSE");
  });

  it("reads API keys from env", () => {
    vi.stubEnv("FINNHUB_API_KEY", "test-key");
    const config = parseConfig([]);
    expect(config.env.FINNHUB_API_KEY).toBe("test-key");
  });

  it("returns undefined for missing env vars", () => {
    const config = parseConfig([]);
    expect(config.env.FINNHUB_API_KEY).toBeUndefined();
  });
});
```

**Step 2: Write registry test**

Create `src/__tests__/registry.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { resolveEnabledModules } from "../registry.js";
import type { ModuleDefinition } from "../shared/types.js";

const mockModules: ModuleDefinition[] = [
  { name: "free-mod", description: "Free", requiredEnvVars: [], tools: [] },
  { name: "paid-mod", description: "Paid", requiredEnvVars: ["PAID_KEY"], tools: [] },
  { name: "multi-key", description: "Multi", requiredEnvVars: ["KEY_A", "KEY_B"], tools: [] },
];

describe("resolveEnabledModules", () => {
  it("enables modules with no required env vars", () => {
    const result = resolveEnabledModules(mockModules, {});
    expect(result.map((m) => m.name)).toEqual(["free-mod"]);
  });

  it("enables modules when env vars are present", () => {
    const result = resolveEnabledModules(mockModules, { PAID_KEY: "abc" });
    expect(result.map((m) => m.name)).toEqual(["free-mod", "paid-mod"]);
  });

  it("requires ALL env vars for multi-key modules", () => {
    const result = resolveEnabledModules(mockModules, { KEY_A: "a" });
    expect(result.map((m) => m.name)).toEqual(["free-mod"]);
  });

  it("enables multi-key module when all keys present", () => {
    const result = resolveEnabledModules(mockModules, { KEY_A: "a", KEY_B: "b" });
    expect(result.map((m) => m.name)).toEqual(["free-mod", "multi-key"]);
  });

  it("respects explicit module filter", () => {
    const result = resolveEnabledModules(mockModules, { PAID_KEY: "abc" }, ["paid-mod"]);
    expect(result.map((m) => m.name)).toEqual(["paid-mod"]);
  });

  it("skips filtered module if env var missing", () => {
    const result = resolveEnabledModules(mockModules, {}, ["paid-mod"]);
    expect(result).toEqual([]);
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/`
Expected: FAIL

**Step 4: Write config**

Create `src/config.ts`:

```typescript
export interface Config {
  defaultExchange: string;
  enabledModules?: string[];
  env: Record<string, string | undefined>;
}

export function parseConfig(args: string[]): Config {
  let defaultExchange = "NASDAQ";
  let enabledModules: string[] | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--default-exchange" && args[i + 1]) {
      defaultExchange = args[i + 1];
      i++;
    } else if (args[i] === "--modules" && args[i + 1]) {
      enabledModules = args[i + 1].split(",").map((m) => m.trim());
      i++;
    }
  }

  return {
    defaultExchange,
    enabledModules,
    env: {
      FINNHUB_API_KEY: process.env.FINNHUB_API_KEY,
      ALPHA_VANTAGE_API_KEY: process.env.ALPHA_VANTAGE_API_KEY,
    },
  };
}
```

**Step 5: Write registry**

Create `src/registry.ts`:

```typescript
import type { ModuleDefinition } from "./shared/types.js";

export function resolveEnabledModules(
  allModules: ModuleDefinition[],
  env: Record<string, string | undefined>,
  filter?: string[],
): ModuleDefinition[] {
  return allModules.filter((mod) => {
    if (filter && !filter.includes(mod.name)) return false;

    const hasKeys = mod.requiredEnvVars.every((key) => env[key]);
    if (!hasKeys) {
      console.error(`${mod.name}: disabled -- missing ${mod.requiredEnvVars.join(", ")}`);
      return false;
    }

    console.error(`${mod.name}: enabled`);
    return true;
  });
}
```

**Step 6: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/`
Expected: PASS

**Step 7: Commit**

```bash
git add src/config.ts src/registry.ts src/__tests__/
git commit -m "feat: add config parser and module registry with env var resolution"
```
