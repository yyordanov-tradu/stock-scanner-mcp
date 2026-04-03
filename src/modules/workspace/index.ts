import { z } from "zod";
import { ModuleDefinition, successResult, errorResult, ToolResult } from "../../shared/types.js";
import { StorageManager } from "./storage.js";
import { resolveTicker } from "../../shared/resolver.js";
import { withMetadata } from "../../shared/utils.js";

export function createWorkspaceModule(dataDir: string, defaultExchange = "NASDAQ"): ModuleDefinition {
  const storage = new StorageManager(dataDir, defaultExchange);

  const wrapHandler = (handler: (args: any) => Promise<ToolResult>) => async (args: any) => {
    try {
      return await handler(args);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  };

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
        handler: withMetadata(async () => {
          const { data } = await storage.load();
          return successResult(JSON.stringify(data.profile, null, 2));
        }, { source: "workspace" }),
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
        handler: withMetadata(async () => {
          const { data } = await storage.load();
          return successResult(JSON.stringify(data.watchlists, null, 2));
        }, { source: "workspace" }),
      },
      {
        name: "workspace_create_watchlist",
        description: "Create a new empty watchlist.",
        inputSchema: z.object({
          name: z.string().describe("The ID/name of the watchlist (e.g., 'core', 'swing')"),
        }),
        readOnly: false,
        handler: withMetadata(async ({ name }) => {
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
          name: z.string().describe("The ID of the watchlist to update"),
          symbols: z.array(z.string()).describe("Raw symbols to track (e.g., ['AAPL', 'BTC'])"),
        }),
        readOnly: false,
        handler: withMetadata(async ({ name, symbols }) => {
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
          symbol: z.string().describe("The raw symbol (e.g., 'AAPL')"),
        }),
        readOnly: true,
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
          symbol: z.string(),
          summary: z.string(),
          bullCase: z.string().optional(),
          bearCase: z.string().optional(),
          catalyst: z.string().optional(),
          timeframe: z.string().optional(),
        }),
        readOnly: false,
        handler: withMetadata(async ({ symbol, summary, bullCase, bearCase, catalyst, timeframe }) => {
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
