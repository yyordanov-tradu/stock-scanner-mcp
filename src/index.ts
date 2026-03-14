#!/usr/bin/env node

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { parseConfig } from "./config.js";

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

MODULES (25 tools total)
  tradingview        6 tools  Stock scanning, quotes, technicals       (no key)
  tradingview-crypto 4 tools  Crypto pair scanning and technicals      (no key)
  sec-edgar          6 tools  SEC filings, insider trades, holdings    (no key)
  coingecko          3 tools  Crypto market data and trending          (no key)
  finnhub            3 tools  Market news and earnings calendar        (FINNHUB_API_KEY)
  alpha-vantage      3 tools  Stock quotes and company fundamentals    (ALPHA_VANTAGE_API_KEY)

SETUP (Claude Code)
  Add to ~/.claude.json or .mcp.json:

  {
    "mcpServers": {
      "stock-scanner": {
        "command": "npx",
        "args": ["-y", "stock-scanner-mcp"],
        "env": {
          "FINNHUB_API_KEY": "your-key",
          "ALPHA_VANTAGE_API_KEY": "your-key"
        }
      }
    }
  }

DOCS
  https://github.com/yyordanov-tradu/stock-scanner-mcp
`.trimStart();

  console.log(help);
}

async function main() {
  const args = process.argv.slice(2);

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
  console.error(
    `stock-scanner MCP server running -- ${enabled.length} modules, ` +
    `${enabled.reduce((n, m) => n + m.tools.length, 0)} tools`,
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
