import { z } from "zod";
import { ModuleDefinition, successResult, errorResult } from "../../shared/types.js";
import { StorageManager } from "./storage.js";
import { resolveTicker } from "../../shared/resolver.js";
import { withMetadata } from "../../shared/utils.js";
import { RESERVED_KEYS } from "./types.js";

export function createWorkspaceModule(dataDir: string, defaultExchange = "NASDAQ"): ModuleDefinition {
  const storage = new StorageManager(dataDir, defaultExchange);

  return {
    name: "workspace",
    description: "Stateful market workspace for watchlists, profiles, and theses.",
    requiredEnvVars: [],
    // Response shape convention: all tools use successResult(JSON.stringify(data, null, 2)).
    // Read tools return domain data directly (profile object, watchlists record, thesis lookup).
    // Write tools return { success, message, ...context } envelopes so the LLM confirms the operation.
    tools: [
      {
        name: "workspace_get_profile",
        description: "Get the current user's trading profile and workspace settings.",
        inputSchema: z.object({}),
        readOnly: true,
        openWorld: false,
        handler: withMetadata(async () => {
          const { data } = await storage.load();
          return successResult(JSON.stringify(data.profile, null, 2));
        }, { source: "workspace" }),
      },
      {
        name: "workspace_update_profile",
        description: "Update the user's trading profile (style, asset focus, review cadence).",
        inputSchema: z.object({
          tradingStyle: z.string().max(100).optional().describe("E.g., 'options', 'swing', 'day'"),
          assetFocus: z.array(z.string().max(50)).max(20).optional().describe("Asset classes like 'equities', 'crypto'"),
          workflowCadence: z.enum(["daily", "weekly"]).optional(),
        }),
        readOnly: false,
        openWorld: false,
        handler: withMetadata(async ({ tradingStyle, assetFocus, workflowCadence }) => {
          const { data, lastModified } = await storage.load();

          if (tradingStyle !== undefined) data.profile.tradingStyle = tradingStyle;
          if (assetFocus !== undefined) data.profile.assetFocus = assetFocus;
          if (workflowCadence !== undefined) data.profile.workflowCadence = workflowCadence;

          data.profile.updatedAt = new Date().toISOString();

          await storage.save(data, lastModified);
          return successResult(JSON.stringify({
            success: true,
            message: "Profile updated successfully.",
            profile: data.profile
          }, null, 2));
        }, { source: "workspace" }),
      },
      {
        name: "workspace_list_watchlists",
        description: "List all watchlists and their instruments.",
        inputSchema: z.object({}),
        readOnly: true,
        openWorld: false,
        handler: withMetadata(async () => {
          const { data } = await storage.load();
          return successResult(JSON.stringify(data.watchlists, null, 2));
        }, { source: "workspace" }),
      },
      {
        name: "workspace_create_watchlist",
        description: "Create a new empty watchlist.",
        inputSchema: z.object({
          name: z.string().max(100).describe("The ID/name of the watchlist (e.g., 'core', 'swing')"),
        }),
        readOnly: false,
        openWorld: false,
        handler: withMetadata(async ({ name }) => {
          if (RESERVED_KEYS.has(name)) {
            return errorResult(`Invalid watchlist name: '${name}' is a reserved keyword.`);
          }

          const { data, lastModified } = await storage.load();

          if (data.watchlists[name]) {
            return errorResult(`Watchlist '${name}' already exists.`);
          }

          data.watchlists[name] = {
            id: name,
            name: name,
            instruments: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          await storage.save(data, lastModified);
          return successResult(JSON.stringify({
            success: true,
            message: `Watchlist '${name}' created successfully.`
          }, null, 2));
        }, { source: "workspace" }),
      },
      {
        name: "workspace_update_watchlist",
        description: "Replace the instruments in a specific watchlist.",
        inputSchema: z.object({
          name: z.string().max(100).describe("The ID of the watchlist to update"),
          symbols: z.array(z.string().max(50)).max(200).describe("Raw symbols to track (e.g., ['AAPL', 'BTC'])"),
        }),
        readOnly: false,
        openWorld: false,
        handler: withMetadata(async ({ name, symbols }) => {
          if (RESERVED_KEYS.has(name)) {
            return errorResult(`Invalid watchlist name: '${name}' is a reserved keyword.`);
          }

          const { data, lastModified } = await storage.load();

          if (!data.watchlists[name]) {
            return errorResult(`Watchlist '${name}' does not exist.`);
          }

          const seen = new Set<string>();
          const instruments = [];

          for (const sym of symbols) {
            const resolved = resolveTicker(sym, data.profile.defaultExchange);
            if (seen.has(resolved.full)) continue;

            seen.add(resolved.full);
            instruments.push({
              full: resolved.full,
              ticker: resolved.ticker,
              exchange: resolved.exchange,
              isCrypto: resolved.isCrypto,
              input: sym,
              addedAt: new Date().toISOString(),
            });
          }

          data.watchlists[name].instruments = instruments;
          data.watchlists[name].updatedAt = new Date().toISOString();

          await storage.save(data, lastModified);
          return successResult(JSON.stringify({
            success: true,
            message: `Watchlist '${name}' updated with ${instruments.length} instruments (deduplicated).`,
            instrumentCount: instruments.length
          }, null, 2));
        }, { source: "workspace" }),
      },
      {
        name: "workspace_get_thesis",
        description: "Get the saved global investment thesis for a specific symbol. Returns a stable JSON shape with a 'found' flag.",
        inputSchema: z.object({
          symbol: z.string().max(50).describe("The raw symbol (e.g., 'AAPL')"),
        }),
        readOnly: true,
        openWorld: false,
        handler: withMetadata(async ({ symbol }) => {
          const { data } = await storage.load();
          const resolved = resolveTicker(symbol, data.profile.defaultExchange);

          const thesis = data.theses[resolved.full];

          return successResult(JSON.stringify({
            found: !!thesis,
            symbol: resolved.full,
            thesis: thesis || null
          }, null, 2));
        }, { source: "workspace" }),
      },
      {
        name: "workspace_save_thesis",
        description: "Save or update the global investment thesis for a specific symbol.",
        inputSchema: z.object({
          symbol: z.string().max(50),
          summary: z.string().max(5000),
          bullCase: z.string().max(2000).optional(),
          bearCase: z.string().max(2000).optional(),
          catalyst: z.string().max(2000).optional(),
          timeframe: z.string().max(100).optional(),
        }),
        readOnly: false,
        openWorld: false,
        handler: withMetadata(async ({ symbol, summary, bullCase, bearCase, catalyst, timeframe }) => {
          if (RESERVED_KEYS.has(symbol) || RESERVED_KEYS.has(symbol.toLowerCase())) {
            return errorResult(`Invalid symbol: '${symbol}' resolves to a reserved keyword.`);
          }

          const { data, lastModified } = await storage.load();
          const resolved = resolveTicker(symbol, data.profile.defaultExchange);

          const existing = data.theses[resolved.full];

          data.theses[resolved.full] = {
            ...existing,
            full: resolved.full,
            ticker: resolved.ticker,
            exchange: resolved.exchange,
            isCrypto: resolved.isCrypto,
            input: symbol,
            summary,
            bullCase: bullCase ?? existing?.bullCase,
            bearCase: bearCase ?? existing?.bearCase,
            catalyst: catalyst ?? existing?.catalyst,
            timeframe: timeframe ?? existing?.timeframe,
            updatedAt: new Date().toISOString(),
          };

          await storage.save(data, lastModified);
          return successResult(JSON.stringify({
            success: true,
            message: `Thesis saved for ${resolved.full}.`,
            ticker: resolved.full
          }, null, 2));
        }, { source: "workspace" }),
      },
    ],
  };
}
