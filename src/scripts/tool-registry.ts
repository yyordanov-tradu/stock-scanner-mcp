import * as os from "node:os";
import { createAlphaVantageModule } from "../modules/alpha-vantage/index.js";
import { createCoingeckoModule } from "../modules/coingecko/index.js";
import { createFinnhubModule } from "../modules/finnhub/index.js";
import { createFrankfurterModule } from "../modules/frankfurter/index.js";
import { createFredModule } from "../modules/fred/index.js";
import { createMarketBreadthModule } from "../modules/market-breadth/index.js";
import { createOptionsModule } from "../modules/options/index.js";
import { createOptionsCboeModule } from "../modules/options-cboe/index.js";
import { createRedditModule } from "../modules/reddit/index.js";
import { createSecEdgarModule } from "../modules/sec-edgar/index.js";
import { createSentimentModule } from "../modules/sentiment/index.js";
import { createTradingviewModule } from "../modules/tradingview/index.js";
import { createTradingviewCryptoModule } from "../modules/tradingview-crypto/index.js";
import { createWorkspaceModule } from "../modules/workspace/index.js";
import type { ModuleDefinition } from "../shared/types.js";

export function buildAllModules(): ModuleDefinition[] {
  return [
    createTradingviewModule(),
    createTradingviewCryptoModule(),
    createSecEdgarModule(),
    createCoingeckoModule(),
    createOptionsModule(),
    createOptionsCboeModule(),
    createFinnhubModule("mock-key"),
    createAlphaVantageModule("mock-key"),
    createFredModule("mock-key"),
    createSentimentModule(),
    createFrankfurterModule(),
    createRedditModule(),
    createMarketBreadthModule(),
    createWorkspaceModule(os.tmpdir()),
  ];
}

export function getRegisteredToolNames(modules = buildAllModules()): Set<string> {
  return new Set(modules.flatMap(module => module.tools.map(tool => tool.name)));
}

export function getRegisteredToolPrefixes(toolNames = getRegisteredToolNames()): Set<string> {
  return new Set([...toolNames].map(name => name.split("_")[0]));
}
