import * as http from "node:http";
import { scanStocks } from "../modules/tradingview/scanner.js";
import { scanCrypto } from "../modules/tradingview-crypto/scanner.js";
import {
  getCompanyNews,
  getEarningsCalendar,
  getAnalystRecommendations,
  getShortInterest,
} from "../modules/finnhub/client.js";
import { searchFilings } from "../modules/sec-edgar/client.js";
import { fetchOptionChain } from "../modules/options/client.js";
import { getFearAndGreed, getCryptoFearAndGreed } from "../modules/sentiment/client.js";
import { getIndicator, getEconomicCalendar } from "../modules/fred/client.js";

export interface SidecarConfig {
  port: number;
  finnhubApiKey?: string;
  fredApiKey?: string;
}

const SYMBOL_RE = /^[A-Z]{1,10}$/i;

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(payload);
}

function parseBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function validateSymbol(symbol: string | null): string {
  if (!symbol) throw new Error("Missing required parameter: symbol");
  if (!SYMBOL_RE.test(symbol)) throw new Error(`Invalid symbol: ${symbol}`);
  return symbol;
}

export function createServer(config: SidecarConfig): http.Server {
  const { finnhubApiKey, fredApiKey } = config;

  const server = http.createServer(async (req, res) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", `http://localhost:${config.port}`);
    const path = url.pathname;
    const params = url.searchParams;

    try {
      // --- Health ---
      if (path === "/health" && req.method === "GET") {
        json(res, 200, { status: "ok" });
        return;
      }

      // --- TradingView stock scan ---
      if (path === "/tradingview/scan" && req.method === "POST") {
        const body = await parseBody(req);
        const result = await scanStocks(body as Parameters<typeof scanStocks>[0]);
        json(res, 200, result);
        return;
      }

      // --- TradingView crypto scan ---
      if (path === "/tradingview-crypto/scan" && req.method === "POST") {
        const body = await parseBody(req);
        const result = await scanCrypto(body as Parameters<typeof scanCrypto>[0]);
        json(res, 200, result);
        return;
      }

      // --- Finnhub endpoints (gated) ---
      if (path.startsWith("/finnhub/")) {
        if (!finnhubApiKey) {
          json(res, 404, { error: "FINNHUB_API_KEY not configured" });
          return;
        }

        if (path === "/finnhub/company-news" && req.method === "GET") {
          const symbol = validateSymbol(params.get("symbol"));
          const from = params.get("from");
          const to = params.get("to");
          if (!from || !to) {
            json(res, 400, { error: "Missing required parameters: from, to" });
            return;
          }
          const limit = params.get("limit") ? Number(params.get("limit")) : undefined;
          const result = await getCompanyNews(finnhubApiKey, symbol, from, to, limit);
          json(res, 200, result);
          return;
        }

        if (path === "/finnhub/earnings" && req.method === "GET") {
          const from = params.get("from");
          const to = params.get("to");
          if (!from || !to) {
            json(res, 400, { error: "Missing required parameters: from, to" });
            return;
          }
          const symbol = params.get("symbol") ?? undefined;
          if (symbol) validateSymbol(symbol);
          const result = await getEarningsCalendar(finnhubApiKey, from, to, symbol);
          json(res, 200, result);
          return;
        }

        if (path === "/finnhub/analyst-ratings" && req.method === "GET") {
          const symbol = validateSymbol(params.get("symbol"));
          const result = await getAnalystRecommendations(finnhubApiKey, symbol);
          json(res, 200, result);
          return;
        }

        if (path === "/finnhub/short-interest" && req.method === "GET") {
          const symbol = validateSymbol(params.get("symbol"));
          const result = await getShortInterest(finnhubApiKey, symbol);
          json(res, 200, result);
          return;
        }
      }

      // --- SEC EDGAR ---
      if (path === "/sec-edgar/filings" && req.method === "GET") {
        const query = params.get("query");
        if (!query) {
          json(res, 400, { error: "Missing required parameter: query" });
          return;
        }
        const dateRange = params.get("dateRange") ?? undefined;
        const forms = params.get("forms") ? params.get("forms")!.split(",") : undefined;
        const tickers = params.get("tickers") ? params.get("tickers")!.split(",") : undefined;
        const limit = params.get("limit") ? Number(params.get("limit")) : undefined;
        const result = await searchFilings({ query, dateRange, forms, tickers, limit });
        json(res, 200, result);
        return;
      }

      // --- Options ---
      if (path === "/options/chain" && req.method === "GET") {
        const symbol = validateSymbol(params.get("symbol"));
        const expiration = params.get("expiration") ? Number(params.get("expiration")) : undefined;
        const result = await fetchOptionChain(symbol, expiration);
        json(res, 200, result);
        return;
      }

      // --- Sentiment ---
      if (path === "/sentiment/fear-greed" && req.method === "GET") {
        const result = await getFearAndGreed();
        json(res, 200, result);
        return;
      }

      if (path === "/sentiment/crypto-fear-greed" && req.method === "GET") {
        const result = await getCryptoFearAndGreed();
        json(res, 200, result);
        return;
      }

      // --- FRED endpoints (gated) ---
      if (path.startsWith("/fred/")) {
        if (!fredApiKey) {
          json(res, 404, { error: "FRED_API_KEY not configured" });
          return;
        }

        if (path === "/fred/indicator" && req.method === "GET") {
          const series = params.get("series");
          if (!series) {
            json(res, 400, { error: "Missing required parameter: series" });
            return;
          }
          const result = await getIndicator(fredApiKey, series);
          json(res, 200, result);
          return;
        }

        if (path === "/fred/calendar" && req.method === "GET") {
          const limit = params.get("limit") ? Number(params.get("limit")) : undefined;
          const result = await getEconomicCalendar(fredApiKey, limit);
          json(res, 200, result);
          return;
        }
      }

      // --- 404 ---
      json(res, 404, { error: "Not found" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Parameter validation errors -> 400
      if (message.startsWith("Missing required parameter") || message.startsWith("Invalid symbol")) {
        json(res, 400, { error: message });
        return;
      }
      json(res, 500, { error: message });
    }
  });

  server.listen(config.port);
  return server;
}
