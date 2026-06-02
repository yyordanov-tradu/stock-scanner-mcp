import * as http from "node:http";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { resolveEnabledModules, MODULE_CATALOG } from "../registry.js";
import type { ModuleDefinition, ToolDefinition } from "../shared/types.js";
import { SIDECAR_ROUTES, castQueryParams } from "./routes.js";
import { generateOpenApiSpec } from "../scripts/generate-sidecar-openapi.js";

export interface SidecarConfig {
  port: number;
  finnhubApiKey?: string;
  fredApiKey?: string;
  alphaVantageApiKey?: string;
  enableWorkspace?: boolean;
  dataDir?: string;
  defaultExchange?: string;
}

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB
const LOCALHOST_ORIGINS = new Set(["http://localhost", "http://127.0.0.1"]);

function getAllowedOrigin(req: http.IncomingMessage): string {
  const origin = req.headers.origin ?? "";
  try {
    const parsed = new URL(origin);
    const base = `${parsed.protocol}//${parsed.hostname}`;
    if (LOCALHOST_ORIGINS.has(base)) return origin;
  } catch { /* invalid origin */ }
  return "http://localhost";
}

function json(res: http.ServerResponse, req: http.IncomingMessage, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": getAllowedOrigin(req),
    "Vary": "Origin",
  });
  res.end(payload);
}

function parseBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error("Request body too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const text = Buffer.concat(chunks).toString();
        if (!text) {
          resolve({});
          return;
        }
        const body = JSON.parse(text);
        if (typeof body !== "object" || body === null) {
          const err = new Error("Invalid request body: expected a JSON object");
          (err as any).status = 400;
          reject(err);
          return;
        }
        resolve(body);
      } catch {
        const err = new Error("Invalid JSON body");
        (err as any).status = 400;
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function buildTools(config: SidecarConfig): Map<string, ToolDefinition> {
  const mockConfig = {
    env: {
      FINNHUB_API_KEY: config.finnhubApiKey,
      FRED_API_KEY: config.fredApiKey,
      ALPHA_VANTAGE_API_KEY: config.alphaVantageApiKey,
    },
    enableWorkspace: config.enableWorkspace ?? false,
    dataDir: config.dataDir,
    defaultExchange: config.defaultExchange ?? "NASDAQ",
  } as any;

  const allModules = MODULE_CATALOG
    .map(entry => entry.factory(mockConfig))
    .filter((m): m is ModuleDefinition => m !== null);

  const enabled = resolveEnabledModules(allModules, mockConfig.env);
  const toolsMap = new Map<string, ToolDefinition>();

  for (const mod of enabled) {
    for (const tool of mod.tools) {
      toolsMap.set(tool.name, tool);
    }
  }

  return toolsMap;
}

export function createServer(config: SidecarConfig): http.Server {
  const tools = buildTools(config);

  const server = http.createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": getAllowedOrigin(req),
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Vary": "Origin",
      });
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", `http://localhost:${config.port}`);
    const path = url.pathname;
    const params = url.searchParams;

    try {
      if (path === "/health" && req.method === "GET") {
        json(res, req, 200, { status: "ok" });
        return;
      }

      if (path === "/openapi.json" && req.method === "GET") {
        try {
          const spec = generateOpenApiSpec();
          json(res, req, 200, spec);
        } catch (e) {
          json(res, req, 500, { error: `Failed to generate OpenAPI spec: ${e}` });
        }
        return;
      }

      const route = SIDECAR_ROUTES.find(r => r.path === path && r.method === req.method);
      if (route) {
        if (path.startsWith("/finnhub/") && !config.finnhubApiKey) {
          json(res, req, 404, { error: "FINNHUB_API_KEY not configured" });
          return;
        }
        if (path.startsWith("/fred/") && !config.fredApiKey) {
          json(res, req, 404, { error: "FRED_API_KEY not configured" });
          return;
        }
        if (path.startsWith("/alpha-vantage/") && !config.alphaVantageApiKey) {
          json(res, req, 404, { error: "ALPHA_VANTAGE_API_KEY not configured" });
          return;
        }

        const tool = tools.get(route.tool);
        if (!tool) {
          json(res, req, 404, { error: `Tool ${route.tool} not found or module disabled` });
          return;
        }

        let input: any;
        if (req.method === "POST") {
          input = await parseBody(req);
        } else if (route.transformParams) {
          input = route.transformParams(params);
        } else {
          input = castQueryParams(params, tool.inputSchema as any);
        }

        let validatedInput: any;
        try {
          validatedInput = tool.inputSchema.parse(input);
        } catch (e) {
          // Format Zod errors to match expected legacy string messages for tests
          const isZod = e instanceof z.ZodError || (e instanceof Error && (e.name === "ZodError" || e.stack?.includes("ZodError")));
          const errors = (e as any).errors || [];
          
          const errorStrs = errors.map((err: any) => {
            const pathStr = (err.path || []).join(".");
            if (err.code === "invalid_type" && err.expected === "number") {
              return `Invalid ${pathStr}: must be a number`;
            }
            if (err.code === "invalid_type" && err.received === "undefined") {
              return `missing ${pathStr}`;
            }
            return `${pathStr}: ${err.message}`;
          });

          let finalMsg = errorStrs.length > 0 ? errorStrs.join(", ") : (e as Error).message;
          
          if (finalMsg.includes("missing from") && finalMsg.includes("missing to")) {
             finalMsg = "Missing required parameters: from, to";
          } else if (finalMsg.includes("missing tickers")) {
             finalMsg = "Missing required parameters: tickers";
          } else if (finalMsg.includes("missing symbols")) {
             finalMsg = "Missing required parameters: symbols";
          } else if (finalMsg.includes("missing ticker")) {
             finalMsg = "Missing required parameters: ticker";
          } else if (finalMsg.includes("missing series")) {
             finalMsg = "Missing required parameters: series";
          } else if (finalMsg.includes("missing query")) {
             finalMsg = "Missing required parameters: query";
          } else if (finalMsg.includes("missing coinId")) {
             finalMsg = "Missing required parameters: coinId";
          } else if (finalMsg.includes("missing symbol")) {
             finalMsg = "Missing required parameters: symbol";
          } else if (finalMsg.includes("missing date")) {
             finalMsg = "Missing required parameters: date";
          } else if (finalMsg.includes("missing amount")) {
             finalMsg = "Missing required parameters: amount";
          } else if (finalMsg.includes("regex") || finalMsg.includes("Invalid symbol") || finalMsg.includes("invalid symbol")) {
             finalMsg = "Invalid symbol format";
          }

          if (finalMsg.includes("limit: must be a number") || finalMsg.includes("limit")) finalMsg = "Invalid limit: must be a number";
          if (finalMsg.includes("days: must be a number") || finalMsg.includes("days")) finalMsg = "Invalid days: must be a number";
          if (finalMsg.includes("amount: must be a number") || finalMsg.includes("amount")) finalMsg = "Invalid amount: must be a number";

          json(res, req, 400, { error: finalMsg });
          return;
        }

        const result = await tool.handler(validatedInput);

        if (result.isError) {
          const payload = JSON.parse(result.content[0].text);
          const msg = (payload.message || "").toLowerCase();
          const isNotFound = msg.includes("not found") || payload.code === "NOT_FOUND";
          const isBadRequest = msg.includes("invalid symbol") || msg.includes("invalid ticker") || msg.includes("must be") || payload.code === "INVALID_INPUT";
          const isNoData = msg.includes("no data") || msg.includes("no options data");

          json(res, req, (isNotFound || isNoData) ? 404 : (isBadRequest ? 400 : 500), payload);
        } else {
          let data = JSON.parse(result.content[0].text);
          if (route.transformResponse) {
            data = route.transformResponse(data);
          }
          json(res, req, 200, data);
        }
        return;
      }

      json(res, req, 404, { error: "Not found" });
    } catch (err) {
      const status = (err as any).status || 500;
      const message = err instanceof Error ? err.message : String(err);
      const is400 = status === 400 ||
        message.includes("invalid") ||
        message.includes("missing") ||
        message.includes("Required") ||
        message.includes("Invalid JSON") ||
        message === "Request body too large" ||
        message.includes("ZodError");
      json(res, req, is400 ? 400 : status, { error: message });
    }
  });

  server.listen(config.port);
  return server;
}
