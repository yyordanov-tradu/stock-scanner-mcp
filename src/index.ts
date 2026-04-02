#!/usr/bin/env node

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { parseConfig } from "./config.js";
import { runInstallSkills } from "./skills-installer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));
import { resolveEnabledModules } from "./registry.js";
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

interface ModuleCatalogEntry {
  name: string;
  envVar: string | null;
  toolCount: number;
  factory: (env: Record<string, string | undefined>) => ModuleDefinition | null;
}

const MODULE_CATALOG: ModuleCatalogEntry[] = [
  { name: "tradingview", envVar: null, toolCount: 10, factory: () => createTradingviewModule() },
  { name: "tradingview-crypto", envVar: null, toolCount: 4, factory: () => createTradingviewCryptoModule() },
  { name: "sec-edgar", envVar: null, toolCount: 6, factory: () => createSecEdgarModule() },
  { name: "coingecko", envVar: null, toolCount: 3, factory: () => createCoingeckoModule() },
  { name: "options", envVar: null, toolCount: 5, factory: () => createOptionsModule() },
  { name: "options-cboe", envVar: null, toolCount: 1, factory: () => createOptionsCboeModule() },
  { name: "finnhub", envVar: "FINNHUB_API_KEY", toolCount: 9, factory: (env) => env.FINNHUB_API_KEY ? createFinnhubModule(env.FINNHUB_API_KEY) : null },
  { name: "alpha-vantage", envVar: "ALPHA_VANTAGE_API_KEY", toolCount: 5, factory: (env) => env.ALPHA_VANTAGE_API_KEY ? createAlphaVantageModule(env.ALPHA_VANTAGE_API_KEY) : null },
  { name: "fred", envVar: "FRED_API_KEY", toolCount: 4, factory: (env) => env.FRED_API_KEY ? createFredModule(env.FRED_API_KEY) : null },
  { name: "sentiment", envVar: null, toolCount: 2, factory: () => createSentimentModule() },
  { name: "frankfurter", envVar: null, toolCount: 5, factory: () => createFrankfurterModule() },
];

const TOTAL_TOOLS = MODULE_CATALOG.reduce((n, m) => n + m.toolCount, 0);

function buildModules(env: Record<string, string | undefined>): ModuleDefinition[] {
  const modules: ModuleDefinition[] = [
    createTradingviewModule(),
    createTradingviewCryptoModule(),
    createSecEdgarModule(),
    createCoingeckoModule(),
    createOptionsModule(),
    createOptionsCboeModule(),
    createSentimentModule(),
    createFrankfurterModule(),
  ];

  if (env.FINNHUB_API_KEY) {
    modules.push(createFinnhubModule(env.FINNHUB_API_KEY));
  }

  if (env.ALPHA_VANTAGE_API_KEY) {
    modules.push(createAlphaVantageModule(env.ALPHA_VANTAGE_API_KEY));
  }

  if (env.FRED_API_KEY) {
    modules.push(createFredModule(env.FRED_API_KEY));
  }

  return modules;
}

function printHelp(): void {
  const help = `
stock-scanner-mcp v${pkg.version}

MCP server providing Claude Code with stock and crypto market data.

USAGE
  npx stock-scanner-mcp [options]

OPTIONS
  --help, -h              Show this help message
  --modules <list>        Comma-separated modules to enable (default: all available)
  --default-exchange <ex> Default exchange for symbol resolution (default: NASDAQ)

MODULES (54 tools total)
  tradingview        10 tools Stock scanning, quotes, technicals       (no key)
  tradingview-crypto 4 tools  Crypto pair scanning and technicals      (no key)
  sec-edgar          6 tools  SEC filings, insider trades, holdings    (no key)
  coingecko          3 tools  Crypto market data and trending          (no key)
  options            5 tools  Options chains, Greeks, unusual activity  (no key)
  options-cboe       1 tool   CBOE put/call ratio sentiment            (no key)
  sentiment          2 tools  Market & crypto Fear & Greed sentiment   (no key)
  frankfurter        5 tools  Forex exchange rates and conversion       (no key)
  finnhub            9 tools  Quotes, profiles, peers, news, earnings  (FINNHUB_API_KEY)
  alpha-vantage      5 tools  Stock quotes, fundamentals, dividends    (ALPHA_VANTAGE_API_KEY)
  fred               4 tools  Economic calendar, indicators, rates     (FRED_API_KEY)

SETUP (Claude Code)
  Add to ~/.claude.json or .mcp.json:

  {
    "mcpServers": {
      "stock-scanner": {
        "command": "npx",
        "args": ["-y", "stock-scanner-mcp"],
        "env": {
          "FINNHUB_API_KEY": "your-key",
          "ALPHA_VANTAGE_API_KEY": "your-key",
          "FRED_API_KEY": "your-key"
        }
      }
    }
  }

SUBCOMMANDS
  install-skills              Install trading skills to ~/.claude/skills/
    --scope <user|project>    Install scope (default: user)
    --category <name>         Install only one category
    --list                    List available skills
    --force                   Overwrite existing skills

  If npx drops the subcommand (common on first install), use:
    npx -p stock-scanner-mcp stock-scanner-install-skills

DOCS
  https://github.com/yyordanov-tradu/stock-scanner-mcp
`.trimStart();

  process.stderr.write(help + "\n");
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "install-skills") {
    await runInstallSkills(args.slice(1));
    process.exit(0);
  }

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  const config = parseConfig(args);
  const allModules = buildModules(config.env);
  const enabled = resolveEnabledModules(allModules, config.env, config.enabledModules);

  const server = new McpServer({
    name: "stock-scanner",
    version: pkg.version,
  });

  const enabledNames = new Set(enabled.map((m) => m.name));

  for (const mod of enabled) {
    for (const tool of mod.tools) {
      server.registerTool(tool.name, {
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: true,
        },
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
  }

  // Startup module status log
  console.error(`[stock-scanner-mcp] v${pkg.version}\n`);
  console.error("Modules:");
  for (const entry of MODULE_CATALOG) {
    if (enabledNames.has(entry.name)) {
      const reason = entry.envVar ? `${entry.envVar} set` : "no key required";
      console.error(`  \u2713 ${entry.name.padEnd(18)} enabled (${reason})`);
    } else if (config.enabledModules && !config.enabledModules.includes(entry.name)) {
      console.error(`  \u2717 ${entry.name.padEnd(18)} skipped (excluded by --modules)`);
    } else if (entry.envVar) {
      console.error(`  \u2717 ${entry.name.padEnd(18)} skipped (${entry.envVar} not set)`);
    }
  }
  const registeredTools = enabled.reduce((n, m) => n + m.tools.length, 0);
  console.error(`\nTools registered: ${registeredTools}/${TOTAL_TOOLS}`);

  // -- MCP Prompts: analysis workflows & usage rules --

  server.registerPrompt("analyze_stock", {
    description: "Analyze a stock ticker — includes crypto correlation check for crypto-related companies",
    argsSchema: {
      ticker: z.string().describe("Stock ticker symbol (e.g. AAPL, CIFR, MARA)"),
    },
  }, async ({ ticker }) => {
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `Analyze the stock ${ticker}. Follow these steps:`,
              "",
              "1. Get a real-time quote using tradingview_quote",
              "2. Get daily and hourly technicals using tradingview_technicals",
              "3. Get recent company news using finnhub_company_news (last 7 days)",
              "",
              "IMPORTANT — Crypto correlation rule:",
              "If the company is crypto-related (Bitcoin miners like MARA/CIFR/RIOT/CLSK/HUT/IREN,",
              "crypto exchanges like COIN, blockchain companies, or any firm with significant",
              "crypto/Bitcoin exposure), you MUST also:",
              "  - Fetch BTC price via crypto_quote (BINANCE:BTCUSDT)",
              "  - Note BTC's daily % change and trend",
              "  - Comment on the correlation between BTC price action and this stock's move",
              "",
              "4. Summarize: price action, key technicals, news catalysts, and (if applicable) BTC correlation.",
            ].join("\n"),
          },
        },
      ],
    };
  });

  server.registerPrompt("intraday_candidates", {
    description: "Find intraday trading candidates with custom price range and filters",
    argsSchema: {
      min_price: z.string().optional().describe("Minimum stock price (default: 10)"),
      max_price: z.string().optional().describe("Maximum stock price (default: 50)"),
    },
  }, async ({ min_price, max_price }) => {
    const min = min_price || "10";
    const max = max_price || "50";
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `Find intraday trading candidates in the $${min}–$${max} price range:`,
              "",
              "1. Use tradingview_scan with filters: price in range, average_volume_30d > 1M, positive EPS TTM, volume > 500K",
              "2. Get technicals (daily + hourly) for the top results",
              "3. Rank by: ATR (higher = more intraday range), volume, and technical setup",
              "",
              "IMPORTANT — Crypto correlation rule:",
              "If any candidate is crypto-related (Bitcoin miners, crypto exchanges, blockchain companies),",
              "also fetch BTC price via crypto_quote (BINANCE:BTCUSDT) and note the correlation.",
              "",
              "4. Present top 5 candidates with: price, EPS, P/E, ATR, volume, volatility %, technical signal, and setup type.",
            ].join("\n"),
          },
        },
      ],
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Server ready.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
