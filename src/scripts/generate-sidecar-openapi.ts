import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf-8"));

const openapi = {
  openapi: "3.1.0",
  info: {
    title: "Stock Scanner Sidecar API",
    description: "REST API for stock and crypto market data, SEC filings, and technical analysis. This is the HTTP sidecar for the stock-scanner-mcp server.",
    version: pkg.version,
    contact: {
      name: "Yordan Yordanov",
      url: "https://github.com/yyordanov-tradu/stock-scanner-mcp"
    },
    license: {
      name: "MIT",
      url: "https://opensource.org/licenses/MIT"
    }
  },
  servers: [
    {
      "url": "http://localhost:3200",
      "description": "Local Sidecar Server"
    }
  ],
  paths: {} as any,
  components: {
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string" }
        }
      }
    }
  }
};

function addGet(path: string, summary: string, params: any[] = [], responseSchema: any = { type: "object" }) {
  openapi.paths[path] = openapi.paths[path] || {};
  openapi.paths[path].get = {
    summary,
    parameters: params.map(p => ({
      name: p.name,
      in: "query",
      required: p.required ?? false,
      description: p.description,
      schema: p.schema ?? { type: "string" }
    })),
    responses: {
      "200": {
        description: "Successful response",
        content: {
          "application/json": {
            schema: responseSchema
          }
        }
      },
      "400": {
        description: "Invalid parameters",
        content: { "application/json": { schema: { "$ref": "#/components/schemas/Error" } } }
      },
      "404": {
        description: "Not found or API key missing",
        content: { "application/json": { schema: { "$ref": "#/components/schemas/Error" } } }
      }
    }
  };
}

function addPost(path: string, summary: string, bodySchema: any, responseSchema: any = { type: "object" }) {
  openapi.paths[path] = openapi.paths[path] || {};
  openapi.paths[path].post = {
    summary,
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: bodySchema
        }
      }
    },
    responses: {
      "200": {
        description: "Successful response",
        content: {
          "application/json": {
            schema: responseSchema
          }
        }
      },
      "400": {
        description: "Invalid request body",
        content: { "application/json": { schema: { "$ref": "#/components/schemas/Error" } } }
      }
    }
  };
}

// --- Define Endpoints ---

addGet("/health", "Health check", [], { type: "object", properties: { status: { type: "string" } } });

// TradingView
addPost("/tradingview/scan", "Scan US stocks", { type: "object", description: "Standard TradingView scanner parameters" });
addGet("/tradingview/quote", "Get stock quotes", [{ name: "tickers", required: true, description: "Comma-separated tickers (AAPL,MSFT)" }]);
addGet("/tradingview/technicals", "Get technical indicators", [
  { name: "tickers", required: true, description: "Comma-separated tickers" },
  { name: "timeframe", description: "e.g., 1h, 1d" }
]);
addGet("/tradingview/compare", "Compare stocks", [{ name: "tickers", required: true, description: "2-5 comma-separated tickers" }]);
addGet("/tradingview/top-gainers", "Top gaining stocks", [
  { name: "exchange", description: "NASDAQ, NYSE, AMEX" },
  { name: "include_otc", schema: { type: "boolean" } },
  { name: "limit", schema: { type: "integer" } }
]);
addGet("/tradingview/top-losers", "Top losing stocks", [
  { name: "exchange" },
  { name: "include_otc", schema: { type: "boolean" } },
  { name: "limit", schema: { type: "integer" } }
]);
addGet("/tradingview/top-volume", "Highest volume stocks", [
  { name: "exchange" },
  { name: "include_otc", schema: { type: "boolean" } },
  { name: "limit", schema: { type: "integer" } }
]);
addGet("/tradingview/market-indices", "Market indices (VIX, SPX, NDX, DJI)");
addGet("/tradingview/sector-performance", "S&P 500 sector performance");
addGet("/tradingview/volume-breakout", "Unusual volume breakouts", [
  { name: "exchange" },
  { name: "limit", schema: { type: "integer" } }
]);

// TradingView Crypto
addPost("/tradingview-crypto/scan", "Scan crypto pairs", { type: "object" });
addGet("/tradingview-crypto/quote", "Get crypto quotes", [{ name: "symbols", required: true, description: "Comma-separated pairs (BTCUSDT,ETHUSDT)" }]);
addGet("/tradingview-crypto/technicals", "Crypto technical analysis", [
  { name: "symbols", required: true },
  { name: "timeframe" }
]);
addGet("/tradingview-crypto/top-gainers", "Top gaining crypto pairs", [
  { name: "exchange" },
  { name: "limit", schema: { type: "integer" } }
]);

// Finnhub
addGet("/finnhub/quote", "Real-time stock quote", [{ name: "symbol", required: true }]);
addGet("/finnhub/company-profile", "Company profile", [{ name: "symbol", required: true }]);
addGet("/finnhub/company-news", "Company news", [
  { name: "symbol", required: true },
  { name: "from", required: true, description: "YYYY-MM-DD" },
  { name: "to", required: true, description: "YYYY-MM-DD" },
  { name: "limit", schema: { type: "integer" } }
]);
addGet("/finnhub/earnings", "Earnings calendar", [
  { name: "from", required: true },
  { name: "to", required: true },
  { name: "symbol" }
]);
addGet("/finnhub/analyst-ratings", "Analyst ratings", [{ name: "symbol", required: true }]);
addGet("/finnhub/short-interest", "Short interest", [{ name: "symbol", required: true }]);
addGet("/finnhub/market-news", "General market news", [
  { name: "category", description: "general, forex, crypto, merger" },
  { name: "limit", schema: { type: "integer" } }
]);
addGet("/finnhub/peers", "Industry peers", [{ name: "symbol", required: true }]);
addGet("/finnhub/market-status", "Exchange status", [{ name: "exchange", description: "e.g., US" }]);

// SEC EDGAR
addGet("/sec-edgar/filings", "Search SEC filings", [
  { name: "query", required: true },
  { name: "dateRange", description: "YYYY-MM-DD,YYYY-MM-DD" },
  { name: "forms", description: "Comma-separated (10-K,10-Q)" },
  { name: "tickers", description: "Comma-separated" },
  { name: "limit", schema: { type: "integer" } }
]);
addGet("/sec-edgar/company-filings", "Company specific filings", [
  { name: "ticker", required: true },
  { name: "forms" },
  { name: "limit", schema: { type: "integer" } }
]);
addGet("/sec-edgar/company-facts", "Company financial facts (XBRL)", [{ name: "ticker", required: true }]);
addGet("/sec-edgar/insider-trades", "Insider transaction history", [
  { name: "ticker", required: true },
  { name: "limit", schema: { type: "integer" } }
]);
addGet("/sec-edgar/institutional-holdings", "Institutional holdings (13F)", [
  { name: "query", required: true, description: "Ticker or manager name" },
  { name: "limit", schema: { type: "integer" } }
]);
addGet("/sec-edgar/ownership-filings", "Major ownership changes (13D/13G)", [
  { name: "ticker", required: true },
  { name: "limit", schema: { type: "integer" } }
]);

// Options
addGet("/options/chain", "Options chain", [
  { name: "symbol", required: true },
  { name: "expiration", schema: { type: "integer" }, description: "Unix timestamp" }
]);
addGet("/options/expirations", "Available expiration dates", [{ name: "symbol", required: true }]);
addGet("/options/unusual-activity", "Unusual options activity", [
  { name: "symbol", required: true },
  { name: "volume_oi_ratio", schema: { type: "number" } },
  { name: "min_volume", schema: { type: "number" } },
  { name: "side", description: "call, put, both" }
]);
addGet("/options/max-pain", "Options max pain strike", [
  { name: "symbol", required: true },
  { name: "expiration", description: "YYYY-MM-DD" }
]);
addGet("/options/implied-move", "Expected price move from straddle", [
  { name: "symbol", required: true },
  { name: "expiration", description: "YYYY-MM-DD" }
]);
addGet("/options/put-call-ratio", "CBOE Put/Call ratio", [
  { name: "type", description: "total, equity, index" },
  { name: "days", schema: { type: "integer" } }
]);

// Sentiment
addGet("/sentiment/fear-greed", "CNN Fear & Greed Index");
addGet("/sentiment/crypto-fear-greed", "Crypto Fear & Greed Index");

// FRED
addGet("/fred/indicator", "Latest economic indicator value", [{ name: "series", required: true, description: "Series ID (e.g., CPIAUCSL)" }]);
addGet("/fred/calendar", "Economic release calendar", [{ name: "limit", schema: { type: "integer" } }]);
addGet("/fred/indicator-history", "Historical economic data", [
  { name: "series", required: true },
  { name: "startDate", required: true },
  { name: "endDate", required: true },
  { name: "units", description: "lin, change, chg, pch, pc1, pca, cch, cca, log" }
]);
addGet("/fred/search", "Search FRED series", [
  { name: "query", required: true },
  { name: "limit", schema: { type: "integer" } }
]);

// Alpha Vantage
addGet("/alpha-vantage/quote", "Stock quote (Alpha Vantage)", [{ name: "symbol", required: true }]);
addGet("/alpha-vantage/daily", "Daily price history", [
  { name: "symbol", required: true },
  { name: "limit", schema: { type: "integer" } }
]);
addGet("/alpha-vantage/overview", "Company fundamentals", [{ name: "symbol", required: true }]);
addGet("/alpha-vantage/earnings", "Quarterly earnings history", [
  { name: "symbol", required: true },
  { name: "limit", schema: { type: "integer" } }
]);
addGet("/alpha-vantage/dividends", "Dividend payment history", [{ name: "symbol", required: true }]);

// CoinGecko
addGet("/coingecko/coin", "Detailed coin info", [{ name: "coinId", required: true, description: "e.g., bitcoin, solana" }]);
addGet("/coingecko/trending", "Top trending coins");
addGet("/coingecko/global", "Global crypto market stats");

// Frankfurter
addGet("/frankfurter/latest", "Latest forex rates", [
  { name: "base", description: "Base currency (default USD)" },
  { name: "symbols", description: "Comma-separated target currencies" }
]);
addGet("/frankfurter/historical", "Historical forex rates", [
  { name: "date", required: true, description: "YYYY-MM-DD" },
  { name: "base" },
  { name: "symbols" }
]);
addGet("/frankfurter/timeseries", "Forex rate history", [
  { name: "start_date", required: true },
  { name: "symbols", required: true },
  { name: "base" },
  { name: "end_date" }
]);
addGet("/frankfurter/convert", "Currency conversion", [
  { name: "amount", required: true, schema: { type: "number" } },
  { name: "from", required: true },
  { name: "to", required: true }
]);
addGet("/frankfurter/currencies", "List supported currency codes");

const outputPath = join(__dirname, "../../docs/sidecar-openapi.json");
writeFileSync(outputPath, JSON.stringify(openapi, null, 2), "utf-8");
console.log(`OpenAPI spec generated at ${outputPath}`);
