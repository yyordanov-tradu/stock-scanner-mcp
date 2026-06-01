#!/usr/bin/env tsx
/**
 * Tool description quality validator.
 *
 * Checks every MCP tool definition for:
 *   1. Description quality (length, data-source mention, value-scale docs)
 *   2. Schema quality (every param has .describe(), defaults via .default())
 *   3. Structural consistency (name prefix matches module, no duplicates)
 *
 * Exit 0 = all pass, Exit 1 = failures found.
 *
 * Usage:  npm run validate-tools
 */

import { z } from "zod";
import { createTradingviewModule } from "../modules/tradingview/index.js";
import { createTradingviewCryptoModule } from "../modules/tradingview-crypto/index.js";
import { createSecEdgarModule } from "../modules/sec-edgar/index.js";
import { createCoingeckoModule } from "../modules/coingecko/index.js";
import { createFinnhubModule } from "../modules/finnhub/index.js";
import { createAlphaVantageModule } from "../modules/alpha-vantage/index.js";
import { createOptionsModule } from "../modules/options/index.js";
import { createOptionsCboeModule } from "../modules/options-cboe/index.js";
import { createFredModule } from "../modules/fred/index.js";
import { createSentimentModule } from "../modules/sentiment/index.js";
import { createFrankfurterModule } from "../modules/frankfurter/index.js";
import { createRedditModule } from "../modules/reddit/index.js";
import { createWorkspaceModule } from "../modules/workspace/index.js";
import type { ModuleDefinition, ToolDefinition } from "../shared/types.js";
import * as os from "node:os";

// ── Constants ────────────────────────────────────────────────────────

const MIN_DESCRIPTION_LENGTH = 50;

const MODULE_PREFIX_MAP: Record<string, string[]> = {
  tradingview: ["tradingview_"],
  "tradingview-crypto": ["crypto_"],
  "sec-edgar": ["edgar_"],
  coingecko: ["coingecko_"],
  options: ["options_"],
  "options-cboe": ["options_"],
  finnhub: ["finnhub_"],
  "alpha-vantage": ["alphavantage_"],
  fred: ["fred_"],
  sentiment: ["sentiment_"],
  frankfurter: ["frankfurter_"],
  reddit: ["reddit_"],
  workspace: ["workspace_"],
};

const DATA_SOURCE_KEYWORDS: Record<string, string[]> = {
  tradingview: ["tradingview", "15-min", "15 min", "delayed"],
  "tradingview-crypto": ["tradingview", "real-time", "delayed"],
  "sec-edgar": ["sec", "edgar", "filings", "form 4", "13f"],
  coingecko: ["coingecko", "crypto", "market cap"],
  options: ["yahoo", "options", "greeks"],
  "options-cboe": ["cboe", "put/call", "sentiment"],
  finnhub: ["finnhub", "news", "analyst"],
  "alpha-vantage": ["alpha vantage", "fundamental", "dividend"],
  fred: ["fred", "st. louis fed", "economic"],
  sentiment: ["cnn", "fear", "greed"],
  frankfurter: ["frankfurter", "ecb", "forex"],
  reddit: ["reddit", "wallstreetbets", "stocks"],
  workspace: ["local", "saved", "workspace", "profile"],
};

// ── Types ────────────────────────────────────────────────────────────

interface Issue {
  module: string;
  tool: string;
  message: string;
  type: "error" | "warning";
}

// ── Checks ───────────────────────────────────────────────────────────

function checkDescription(tool: ToolDefinition, moduleName: string): Issue[] {
  const issues: Issue[] = [];
  const desc = tool.description;

  if (desc.length < MIN_DESCRIPTION_LENGTH) {
    issues.push({
      module: moduleName,
      tool: tool.name,
      type: "warning",
      message: `Description too short (${desc.length} chars). Aim for > ${MIN_DESCRIPTION_LENGTH}.`,
    });
  }

  const keywords = DATA_SOURCE_KEYWORDS[moduleName] || [];
  const hasKeyword = keywords.some(k => desc.toLowerCase().includes(k));
  if (!hasKeyword) {
    issues.push({
      module: moduleName,
      tool: tool.name,
      type: "warning",
      message: `Description might be missing data-source attribution (expected one of: ${keywords.join(", ")}).`,
    });
  }

  // Common check for percentages and scales that AI often gets wrong
  const returnsPercentage = desc.includes("%") || desc.includes("percent");
  const mentionsScale = desc.includes("0-100") || desc.includes("basis points") || desc.includes("0 to 1");

  // Filter out Reddit sentiment/mentions which are counts/scores, not price %
  const isReddit = moduleName === "reddit";
  // Filter out SEC filings that just mention buy/sell as transaction types or general concepts
  const returnsRating =
    desc.includes("recommendation") ||
    desc.includes("consensus") ||
    (desc.includes("rating") && !desc.includes("analyst rating")) ||
    desc.includes("score");

  if ((returnsPercentage || returnsRating) && !mentionsScale && !isReddit) {
    issues.push({
      module: moduleName,
      tool: tool.name,
      type: "warning",
      message: `Tool returns percentages or scores but doesn't document the value scale (e.g., "0-100", "0 to 1").`,
    });
  }

  return issues;
}

function hasDescription(schema: z.ZodTypeAny): boolean {
  if (schema.description) return true;
  const def = (schema as any)._def;
  if (!def) return false;
  if (def.description) return true;

  // Check inner type for ZodOptional, ZodDefault, ZodNullable
  if (def.innerType) return hasDescription(def.innerType);

  return false;
}

function checkParamDescriptions(tool: ToolDefinition, moduleName: string): Issue[] {
  const issues: Issue[] = [];
  const schema = tool.inputSchema as any;

  if (!(schema instanceof z.ZodObject)) {
    return issues;
  }

  const shape = schema.shape;
  for (const [paramName, paramType] of Object.entries(shape)) {
    if (!hasDescription(paramType as z.ZodTypeAny)) {
      issues.push({
        module: moduleName,
        tool: tool.name,
        type: "error",
        message: `Parameter "${paramName}" is missing a .describe().`,
      });
    }
  }

  return issues;
}

function checkNamePrefix(tool: ToolDefinition, moduleName: string): Issue | null {
  const allowedPrefixes = MODULE_PREFIX_MAP[moduleName];
  if (!allowedPrefixes) return null;

  const hasPrefix = allowedPrefixes.some(p => tool.name.startsWith(p));
  if (!hasPrefix) {
    return {
      module: moduleName,
      tool: tool.name,
      type: "error",
      message: `Tool name must start with one of: ${allowedPrefixes.join(", ")}.`,
    };
  }
  return null;
}

function checkDuplicateNames(tools: ToolDefinition[], moduleName: string, seen: Map<string, string>): Issue[] {
  const issues: Issue[] = [];
  for (const tool of tools) {
    if (seen.has(tool.name)) {
      issues.push({
        module: moduleName,
        tool: tool.name,
        type: "error",
        message: `Duplicate tool name found (already defined in module "${seen.get(tool.name)}").`,
      });
    } else {
      seen.set(tool.name, moduleName);
    }
  }
  return issues;
}

function checkValueScale(tool: ToolDefinition, moduleName: string): Issue | null {
  const desc = tool.description.toLowerCase();
  // Check for common indicators that a tool returns numeric data that needs scale documentation
  const numericIndicators = ["price", "volume", "rsi", "macd", "indicator", "ratio", "change"];
  const needsScale = numericIndicators.some(i => desc.includes(i));
  const hasScale = desc.includes("basis points") || desc.includes("percent") || desc.includes("%") || 
                   desc.includes("0-100") || desc.includes("0 to 1") || desc.includes("absolute") ||
                   desc.includes("dollars") || desc.includes("units");

  if (needsScale && !hasScale && moduleName !== "reddit" && moduleName !== "workspace") {
    return {
      module: moduleName,
      tool: tool.name,
      type: "warning",
      message: "Tool returns numeric data but may be missing unit/scale documentation (e.g. 'in USD', '0-100').",
    };
  }
  return null;
}

// ── Main ─────────────────────────────────────────────────────────────

function buildAllModules(): ModuleDefinition[] {
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
    createWorkspaceModule(os.tmpdir()),
  ];
}

function validate(): boolean {
  const modules = buildAllModules();
  const allIssues: Issue[] = [];
  const allTools: Array<{ tool: ToolDefinition; module: string }> = [];
  let totalTools = 0;

  console.log("\n\u001b[1m\u001b[36mStock Scanner Tool Validator\u001b[0m");
  console.log("──────────────────────────────────────────────────");

  const seenNames = new Map<string, string>();

  for (const mod of modules) {
    const moduleIssues: Issue[] = [];
    const tools = mod.tools;
    totalTools += tools.length;

    // Check duplicate names across all modules
    moduleIssues.push(...checkDuplicateNames(tools, mod.name, seenNames));

    for (const tool of tools) {
      allTools.push({ tool, module: mod.name });

      const prefixIssue = checkNamePrefix(tool, mod.name);
      if (prefixIssue) moduleIssues.push(prefixIssue);

      const descIssues = checkDescription(tool, mod.name);
      moduleIssues.push(...descIssues);

      const scaleIssue = checkValueScale(tool, mod.name);
      if (scaleIssue) moduleIssues.push(scaleIssue);

      const paramIssues = checkParamDescriptions(tool, mod.name);
      moduleIssues.push(...paramIssues);
    }

    allIssues.push(...moduleIssues);

    if (moduleIssues.length === 0) {
      console.log(`\u001b[32m  \u2713 ${mod.name} (${tools.length} tools)\u001b[0m`);
    } else {
      const errors = moduleIssues.filter(i => i.type === "error");
      const warnings = moduleIssues.filter(i => i.type === "warning");
      console.log(
        `\u001b[31m  \u2717 ${mod.name} (${tools.length} tools) — ` +
        (errors.length > 0 ? `\u001b[31m${errors.length} errors\u001b[0m` : "") +
        (errors.length > 0 && warnings.length > 0 ? ", " : "") +
        (warnings.length > 0 ? `\u001b[33m${warnings.length} warnings\u001b[0m` : "")
      );

      for (const issue of moduleIssues) {
        const icon = issue.type === "error" ? "\u001b[31m[E]\u001b[0m" : "\u001b[33m[W]\u001b[0m";
        console.log(`     ${icon} \u001b[1m${issue.tool}\u001b[0m: ${issue.message}`);
      }
    }
  }

  console.log("──────────────────────────────────────────────────");
  const errors = allIssues.filter(i => i.type === "error");
  const warnings = allIssues.filter(i => i.type === "warning");

  if (errors.length === 0) {
    console.log(`\n\u001b[32m\u001b[1m✓ ALL ${totalTools} TOOLS PASSED VALIDATION\u001b[0m` + (warnings.length > 0 ? ` (${warnings.length} warnings)` : ""));
  } else {
    console.log(
      `\n\u001b[31m\u001b[1m\u2717 VALIDATION FAILED: \u001b[0m` +
        (errors.length > 0 ? `\u001b[31m${errors.length} errors\u001b[0m` : "") +
        (warnings.length > 0 ? `, \u001b[33m${warnings.length} warnings\u001b[0m` : ""),
    );
  }
  console.log();

  return errors.length === 0;
}

const passed = validate();
process.exit(passed ? 0 : 1);
