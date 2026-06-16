import type { ModuleDefinition } from "./shared/types.js";
import { createTradingviewModule } from "./modules/tradingview/index.js";
import { createTradingviewCryptoModule } from "./modules/tradingview-crypto/index.js";
import { createSecEdgarModule } from "./modules/sec-edgar/index.js";
import { createCoingeckoModule } from "./modules/coingecko/index.js";
import { createFinnhubModule } from "./modules/finnhub/index.js";
import { createAlphaVantageModule } from "./modules/alpha-vantage/index.js";
import { createOptionsModule } from "./modules/options/index.js";
import { createOptionsCboeModule } from "./modules/options-cboe/index.js";
import { createFredModule } from "./modules/fred/index.js";
import { createSentimentModule } from "./modules/sentiment/index.js";
import { createFrankfurterModule } from "./modules/frankfurter/index.js";
import { createRedditModule } from "./modules/reddit/index.js";
import { createWorkspaceModule } from "./modules/workspace/index.js";
import type { Config } from "./config.js";
import * as path from "node:path";
import * as os from "node:os";

export interface ModuleCatalogEntry {
  name: string;
  envVar: string | null;
  toolCount: number;
  factory: (config: Config) => ModuleDefinition | null;
}

export const MODULE_CATALOG: ModuleCatalogEntry[] = [
  { name: "tradingview", envVar: null, toolCount: 10, factory: () => createTradingviewModule() },
  { name: "tradingview-crypto", envVar: null, toolCount: 4, factory: () => createTradingviewCryptoModule() },
  { name: "sec-edgar", envVar: null, toolCount: 6, factory: () => createSecEdgarModule() },
  { name: "coingecko", envVar: null, toolCount: 3, factory: () => createCoingeckoModule() },
  { name: "options", envVar: null, toolCount: 5, factory: () => createOptionsModule() },
  { name: "options-cboe", envVar: null, toolCount: 1, factory: () => createOptionsCboeModule() },
  { name: "finnhub", envVar: "FINNHUB_API_KEY", toolCount: 9, factory: (config) => config.env.FINNHUB_API_KEY ? createFinnhubModule(config.env.FINNHUB_API_KEY) : null },
  { name: "alpha-vantage", envVar: "ALPHA_VANTAGE_API_KEY", toolCount: 5, factory: (config) => config.env.ALPHA_VANTAGE_API_KEY ? createAlphaVantageModule(config.env.ALPHA_VANTAGE_API_KEY) : null },
  { name: "fred", envVar: "FRED_API_KEY", toolCount: 4, factory: (config) => config.env.FRED_API_KEY ? createFredModule(config.env.FRED_API_KEY) : null },
  { name: "sentiment", envVar: null, toolCount: 2, factory: () => createSentimentModule() },
  { name: "frankfurter", envVar: null, toolCount: 5, factory: () => createFrankfurterModule() },
  { name: "reddit", envVar: null, toolCount: 4, factory: () => createRedditModule() },
  { name: "workspace", envVar: null, toolCount: 7, factory: (config) => config.enableWorkspace ? createWorkspaceModule(config.dataDir || path.join(os.homedir(), ".stock-scanner-mcp"), config.defaultExchange) : null },
];

export function resolveEnabledModules(
  allModules: ModuleDefinition[],
  env: Record<string, string | undefined>,
  filter?: string[],
): ModuleDefinition[] {
  return allModules.filter((mod) => {
    if (filter && !filter.includes(mod.name)) return false;

    const hasKeys = mod.requiredEnvVars.every((key) => env[key]);
    if (!hasKeys) {
      // In sidecar/server, we might not want to log these errors every time,
      // but for now keeping it consistent with MCP server startup.
      return false;
    }

    return true;
  });
}
