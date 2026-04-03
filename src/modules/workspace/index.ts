import { z } from "zod";
import { ModuleDefinition, successResult, errorResult } from "../../shared/types.js";
import { StorageManager } from "./storage.js";
import { resolveTicker } from "../../shared/resolver.js";
import { ProfileSchema, WatchlistSchema, ThesisSchema } from "./types.js";

export function createWorkspaceModule(dataDir: string): ModuleDefinition {
  const storage = new StorageManager(dataDir);

  return {
    name: "workspace",
    description: "Stateful market workspace for watchlists, profiles, and theses.",
    requiredEnvVars: [],
    tools: [
      {
        name: "workspace_get_profile",
        description: "Get the current user's trading profile and workspace settings.",
        inputSchema: z.object({}),
        readOnly: true,
        handler: async () => {
          const { data } = await storage.load();
          return successResult(JSON.stringify(data.profile, null, 2));
        },
      },
      {
        name: "workspace_update_profile",
        description: "Update the user's trading profile (style, asset focus, review cadence).",
        inputSchema: z.object({
          tradingStyle: z.string().optional().describe("E.g., 'options', 'swing', 'day'"),
          assetFocus: z.array(z.string()).optional().describe("Asset classes like 'equities', 'crypto'"),
          workflowCadence: z.enum(["daily", "weekly"]).optional(),
        }),
        readOnly: false,
        handler: async ({ tradingStyle, assetFocus, workflowCadence }) => {
          const { data, lastModified } = await storage.load();
          
          if (tradingStyle !== undefined) data.profile.tradingStyle = tradingStyle;
          if (assetFocus !== undefined) data.profile.assetFocus = assetFocus;
          if (workflowCadence !== undefined) data.profile.workflowCadence = workflowCadence;
          
          data.profile.updatedAt = new Date().toISOString();
          
          await storage.save(data, lastModified);
          return successResult(`Profile updated successfully.\n${JSON.stringify(data.profile, null, 2)}`);
        },
      },
      {
        name: "workspace_list_watchlists",
        description: "List all watchlists and their instruments.",
        inputSchema: z.object({}),
        readOnly: true,
        handler: async () => {
          const { data } = await storage.load();
          return successResult(JSON.stringify(data.watchlists, null, 2));
        },
      },
      {
        name: "workspace_create_watchlist",
        description: "Create a new empty watchlist.",
        inputSchema: z.object({
          name: z.string().describe("The ID/name of the watchlist (e.g., 'core', 'swing')"),
        }),
        readOnly: false,
        handler: async ({ name }) => {
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
          return successResult(`Watchlist '${name}' created successfully.`);
        },
      },
      {
        name: "workspace_update_watchlist",
        description: "Replace the instruments in a specific watchlist.",
        inputSchema: z.object({
          name: z.string().describe("The ID of the watchlist to update"),
          symbols: z.array(z.string()).describe("Raw symbols to track (e.g., ['AAPL', 'BTC'])"),
        }),
        readOnly: false,
        handler: async ({ name, symbols }) => {
          const { data, lastModified } = await storage.load();
          
          if (!data.watchlists[name]) {
            return errorResult(`Watchlist '${name}' does not exist.`);
          }
          
          const instruments = symbols.map((sym: string) => {
            const resolved = resolveTicker(sym, data.profile.defaultExchange);
            return {
              full: resolved.full,
              ticker: resolved.ticker,
              exchange: resolved.exchange,
              isCrypto: resolved.isCrypto,
              input: sym,
              addedAt: new Date().toISOString(),
            };
          });
          
          data.watchlists[name].instruments = instruments;
          data.watchlists[name].updatedAt = new Date().toISOString();
          
          await storage.save(data, lastModified);
          return successResult(`Watchlist '${name}' updated with ${instruments.length} instruments.`);
        },
      },
      {
        name: "workspace_get_thesis",
        description: "Get the saved global investment thesis for a specific symbol.",
        inputSchema: z.object({
          symbol: z.string().describe("The raw symbol (e.g., 'AAPL')"),
        }),
        readOnly: true,
        handler: async ({ symbol }) => {
          const { data } = await storage.load();
          const resolved = resolveTicker(symbol, data.profile.defaultExchange);
          
          const thesis = data.theses[resolved.full];
          if (!thesis) {
            return errorResult(`No thesis found for ${resolved.full}`);
          }
          
          return successResult(JSON.stringify(thesis, null, 2));
        },
      },
      {
        name: "workspace_save_thesis",
        description: "Save or update the global investment thesis for a specific symbol.",
        inputSchema: z.object({
          symbol: z.string(),
          summary: z.string(),
          bullCase: z.string().optional(),
          bearCase: z.string().optional(),
          catalyst: z.string().optional(),
          timeframe: z.string().optional(),
        }),
        readOnly: false,
        handler: async ({ symbol, summary, bullCase, bearCase, catalyst, timeframe }) => {
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
          return successResult(`Thesis saved for ${resolved.full}.`);
        },
      },
    ],
  };
}
