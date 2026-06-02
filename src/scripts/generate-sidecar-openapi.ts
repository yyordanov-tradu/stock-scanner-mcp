import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { zodToJsonSchema } from "zod-to-json-schema";
import { MODULE_CATALOG } from "../registry.js";
import { SIDECAR_ROUTES } from "../sidecar/routes.js";
import type { ModuleDefinition, ToolDefinition } from "../shared/types.js";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf-8"));

/**
 * Robustly converts a Zod schema to an OpenAPI-compatible JSON schema.
 * Handles Zod v4 incompatibilities and common wrappers.
 */
function convertZodToOpenApi(zod: any): any {
  if (!zod) return { type: "string" };
  const def = zod._def;
  if (!def) return { type: "string" };
  
  const typeName = zod.constructor.name;
  const defType = def.type;
  const description = zod.description || def.description || "";

  if (typeName === "ZodOptional" || typeName === "ZodNullable" || typeName === "ZodDefault" || 
      defType === "optional" || defType === "nullable" || defType === "default") {
    const inner = convertZodToOpenApi(def.innerType || def.schema);
    return { ...inner, optional: true, description: description || inner.description };
  }

  if (typeName === "ZodNumber" || defType === "number") return { type: zod.isInt ? "integer" : "number", description };
  if (typeName === "ZodBoolean" || defType === "boolean") return { type: "boolean", description };
  if (typeName === "ZodEnum" || defType === "enum") return { type: "string", enum: def.values, description };
  if (typeName === "ZodString" || defType === "string") return { type: "string", description };

  if (typeName === "ZodArray" || defType === "array") {
    const items = convertZodToOpenApi(def.element || def.type);
    delete items.optional;
    return { type: "array", items, description };
  }

  if (typeName === "ZodObject" || defType === "object") {
    const properties: Record<string, any> = {};
    const required: string[] = [];
    const shape = zod.shape || (typeof def.shape === 'function' ? def.shape() : def.shape) || {};
    
    for (const [key, value] of Object.entries(shape)) {
      const info = convertZodToOpenApi(value);
      const isOptional = info.optional;
      delete info.optional;
      properties[key] = info;
      if (!isOptional) required.push(key);
    }
    const res: any = { type: "object", properties, description };
    if (required.length > 0) res.required = required;
    return res;
  }

  if (typeName === "ZodUnion" || defType === "union") {
     return { anyOf: (def.options || []).map((o: any) => {
        const info = convertZodToOpenApi(o);
        delete info.optional;
        return info;
     }), description };
  }

  return { type: "string", description };
}

/**
 * Heuristically define response schemas for tool families.
 */
function getResponseSchema(toolName: string): any {
  if (toolName.startsWith("tradingview_") || toolName.startsWith("crypto_")) {
    return {
      type: "array",
      items: {
        type: "object",
        properties: {
          symbol: { type: "string" },
          data: { type: "object", additionalProperties: true }
        }
      }
    };
  }
  
  if (toolName.startsWith("edgar_")) {
    return { type: "array", items: { type: "object", additionalProperties: true } };
  }

  if (toolName === "finnhub_quote") {
    return {
      type: "object",
      properties: {
        c: { type: "number", description: "Current price" },
        d: { type: "number", description: "Change" },
        dp: { type: "number", description: "Percent change" },
        h: { type: "number", description: "High price of the day" },
        l: { type: "number", description: "Low price of the day" },
        o: { type: "number", description: "Open price of the day" },
        pc: { type: "number", description: "Previous close price" },
        t: { type: "integer", description: "Timestamp" }
      }
    };
  }

  if (toolName.startsWith("finnhub_")) {
    return { type: "object", additionalProperties: true };
  }

  if (toolName.startsWith("options_")) {
    return { type: "object", additionalProperties: true };
  }

  if (toolName.startsWith("fred_")) {
    return { type: "array", items: { type: "object", additionalProperties: true } };
  }

  if (toolName.startsWith("workspace_")) {
    return { type: "object", additionalProperties: true };
  }

  return { type: "object", description: "Varies by tool" };
}

export function generateOpenApiSpec() {
  const mockConfig = {
    env: {
      FINNHUB_API_KEY: "MOCK",
      FRED_API_KEY: "MOCK",
      ALPHA_VANTAGE_API_KEY: "MOCK",
    },
    enableWorkspace: true,
    defaultExchange: "NASDAQ",
  } as any;

  const allModules = MODULE_CATALOG
    .map(entry => entry.factory(mockConfig))
    .filter((m): m is ModuleDefinition => m !== null);

  const toolsMap = new Map<string, ToolDefinition>();
  for (const mod of allModules) {
    for (const tool of mod.tools) {
      toolsMap.set(tool.name, tool);
    }
  }

  const openapi: any = {
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
    paths: {},
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

  openapi.paths["/health"] = {
    get: {
      summary: "Health check",
      responses: {
        "200": {
          description: "Server is healthy",
          content: { "application/json": { schema: { type: "object", properties: { status: { type: "string" } } } } }
        }
      }
    }
  };

  for (const route of SIDECAR_ROUTES) {
    const tool = toolsMap.get(route.tool);
    if (!tool) continue;

    const operation: any = {
      summary: tool.description.split(".")[0],
      description: tool.description,
      responses: {
        "200": {
          description: "Successful response",
          content: { 
            "application/json": { 
              schema: getResponseSchema(route.tool)
            } 
          }
        },
        "400": {
          description: "Invalid parameters",
          content: { "application/json": { schema: { "$ref": "#/components/schemas/Error" } } }
        },
        "404": {
          description: "Tool not found or API key missing",
          content: { "application/json": { schema: { "$ref": "#/components/schemas/Error" } } }
        },
        "500": {
          description: "Internal server error",
          content: { "application/json": { schema: { "$ref": "#/components/schemas/Error" } } }
        }
      }
    };

    const jsonSchema = convertZodToOpenApi(tool.inputSchema);
    const properties = { ...jsonSchema.properties };
    const required = new Set(jsonSchema.required || []);

    if (route.path === "/fred/indicator") {
      properties["series"] = { type: "string", description: "Alias for series_id." };
      required.delete("series_id");
    } else if (route.path === "/fred/indicator-history") {
      properties["series"] = { type: "string", description: "Alias for series_id." };
      properties["startDate"] = { type: "string", description: "Alias for start_date." };
      properties["endDate"] = { type: "string", description: "Alias for end_date." };
      required.delete("series_id");
      required.delete("start_date");
      required.delete("end_date");
    } else if (route.path === "/alpha-vantage/overview") {
      properties["symbol"] = { type: "string", description: "Alias for symbols (single symbol)." };
      required.delete("symbols");
    } else if (route.path === "/reddit/trending") {
      properties["subreddits"] = { type: "string", description: "Comma-separated subreddits." };
    } else if (route.path === "/workspace/watchlists/update") {
      properties["symbols"] = { type: "string", description: "Comma-separated symbols." };
    }

    if (route.method === "GET") {
      operation.parameters = Object.entries(properties).map(([name, prop]: [string, any]) => {
        const param: any = {
          name,
          in: "query",
          required: required.has(name),
          description: prop.description || "",
        };

        if (prop.type === "array") {
          const desc = prop.description + " (comma-separated list)";
          param.description = desc;
          param.schema = { type: "string", description: desc };
        } else {
          param.schema = prop;
        }

        return param;
      });
    } else {
      operation.requestBody = {
        required: true,
        content: {
          "application/json": {
            schema: jsonSchema
          }
        }
      };
    }

    openapi.paths[route.path] = openapi.paths[route.path] || {};
    openapi.paths[route.path][route.method.toLowerCase()] = operation;
  }

  return openapi;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const spec = generateOpenApiSpec();
  const outputPath = join(__dirname, "../../docs/sidecar-openapi.json");
  writeFileSync(outputPath, JSON.stringify(spec, null, 2), "utf-8");
  console.log(`OpenAPI spec generated at ${outputPath}`);
}
