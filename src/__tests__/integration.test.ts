import { describe, it, expect, vi, afterEach } from "vitest";
import { parseConfig } from "../config.js";
import { resolveEnabledModules } from "../registry.js";
import { createTradingviewModule } from "../modules/tradingview/index.js";
import { createTradingviewCryptoModule } from "../modules/tradingview-crypto/index.js";
import { createSecEdgarModule } from "../modules/sec-edgar/index.js";
import { createCoingeckoModule } from "../modules/coingecko/index.js";
import { createFinnhubModule } from "../modules/finnhub/index.js";
import { createAlphaVantageModule } from "../modules/alpha-vantage/index.js";
import { createOptionsModule } from "../modules/options/index.js";
import { createOptionsCboeModule } from "../modules/options-cboe/index.js";
import type { ModuleDefinition } from "../shared/types.js";

function buildAllModules(env: Record<string, string | undefined>): ModuleDefinition[] {
  const modules: ModuleDefinition[] = [
    createTradingviewModule(),
    createTradingviewCryptoModule(),
    createSecEdgarModule(),
    createCoingeckoModule(),
    createOptionsModule(),
    createOptionsCboeModule(),
  ];
  if (env.FINNHUB_API_KEY) modules.push(createFinnhubModule(env.FINNHUB_API_KEY));
  if (env.ALPHA_VANTAGE_API_KEY) modules.push(createAlphaVantageModule(env.ALPHA_VANTAGE_API_KEY));
  return modules;
}

describe("full module wiring", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("enables 6 free modules with no API keys", () => {
    const modules = buildAllModules({});
    const enabled = resolveEnabledModules(modules, {});
    expect(enabled.map((m) => m.name)).toEqual([
      "tradingview", "tradingview-crypto", "sec-edgar", "coingecko", "options", "options-cboe",
    ]);
    const totalTools = enabled.reduce((n, m) => n + m.tools.length, 0);
    expect(totalTools).toBe(29); // 10 + 4 + 6 + 3 + 5 + 1 (free modules only)
  });

  it("enables all 8 modules with all API keys", () => {
    const env = {
      FINNHUB_API_KEY: "test-finnhub-key",
      ALPHA_VANTAGE_API_KEY: "test-av-key",
    };
    const modules = buildAllModules(env);
    const enabled = resolveEnabledModules(modules, env);
    expect(enabled).toHaveLength(8);
    const totalTools = enabled.reduce((n, m) => n + m.tools.length, 0);
    expect(totalTools).toBe(43); // 10 + 4 + 6 + 3 + 5 + 1 + 9 + 5
  });

  it("all 43 tool names are unique", () => {
    const env = {
      FINNHUB_API_KEY: "key",
      ALPHA_VANTAGE_API_KEY: "key",
    };
    const modules = buildAllModules(env);
    const enabled = resolveEnabledModules(modules, env);
    const allNames = enabled.flatMap((m) => m.tools.map((t) => t.name));
    expect(new Set(allNames).size).toBe(43);
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

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    for (const mod of enabled) {
      for (const tool of mod.tools) {
        const result = await tool.handler({});
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('"error": true');
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
