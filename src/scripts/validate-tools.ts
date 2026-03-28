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
import type { ModuleDefinition, ToolDefinition } from "../shared/types.js";

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
};

const DATA_SOURCE_KEYWORDS: Record<string, string[]> = {
  tradingview: ["tradingview", "15-min", "15 min", "delayed"],
  "tradingview-crypto": ["tradingview", "crypto", "15-min", "15 min"],
  "sec-edgar": ["sec", "edgar", "xbrl", "filing"],
  coingecko: ["coingecko", "gecko"],
  options: ["option", "yahoo", "greek"],
  "options-cboe": ["cboe", "put/call", "put-call", "sentiment"],
  finnhub: ["finnhub"],
  "alpha-vantage": ["alpha vantage", "alphavantage"],
  fred: ["fred", "economic", "federal reserve"],
  sentiment: ["sentiment", "fear", "greed", "cnn", "alternative"],
  frankfurter: ["frankfurter", "forex", "exchange rate", "ecb", "currency"],
};

// ── Types ────────────────────────────────────────────────────────────

interface Issue {
  tool: string;
  module: string;
  check: string;
  message: string;
  severity: "error" | "warning";
}

// ── Zod introspection helpers ────────────────────────────────────────

function getZodObjectShape(schema: z.ZodType<unknown>): Record<string, z.ZodType<unknown>> | null {
  const def = (schema as { _def?: { typeName?: string; shape?: () => Record<string, z.ZodType<unknown>>; innerType?: z.ZodType<unknown> } })._def;
  if (!def) return null;

  if (def.typeName === "ZodObject" && typeof def.shape === "function") {
    return def.shape();
  }

  // Unwrap ZodEffects (from .transform(), .refine(), etc.)
  if (def.typeName === "ZodEffects" && def.innerType) {
    return getZodObjectShape(def.innerType);
  }

  return null;
}

function hasDescription(zodField: z.ZodType<unknown>): boolean {
  const def = (zodField as { _def?: { description?: string; innerType?: z.ZodType<unknown>; typeName?: string } })._def;
  if (!def) return false;
  if (def.description) return true;

  // Check inner type for ZodOptional, ZodDefault, ZodNullable
  if (def.innerType) return hasDescription(def.innerType);

  return false;
}

// ── Validation checks ────────────────────────────────────────────────

function checkDescriptionLength(tool: ToolDefinition, moduleName: string): Issue | null {
  if (tool.description.length < MIN_DESCRIPTION_LENGTH) {
    return {
      tool: tool.name,
      module: moduleName,
      check: "description-length",
      message: `Description too short (${tool.description.length} chars, min ${MIN_DESCRIPTION_LENGTH})`,
      severity: "error",
    };
  }
  return null;
}

function checkDataSource(tool: ToolDefinition, moduleName: string): Issue | null {
  const keywords = DATA_SOURCE_KEYWORDS[moduleName];
  if (!keywords) return null;

  const desc = tool.description.toLowerCase();
  const toolName = tool.name.toLowerCase();

  // Skip if the tool name already contains the source (e.g. finnhub_quote → "finnhub")
  const nameImpliesSource = keywords.some((kw) => toolName.includes(kw.replace(/\s+/g, "")));
  if (nameImpliesSource) return null;

  const found = keywords.some((kw) => desc.includes(kw));
  if (!found) {
    return {
      tool: tool.name,
      module: moduleName,
      check: "data-source",
      message: `Description doesn't mention data source. Expected one of: ${keywords.join(", ")}`,
      severity: "warning",
    };
  }
  return null;
}

function checkValueScale(tool: ToolDefinition, moduleName: string): Issue | null {
  const desc = tool.description.toLowerCase();

  // Only flag tools that return numeric ratings/scores/recommendations
  // Skip tools that just mention buy/sell as transaction types or general concepts
  const returnsRating =
    desc.includes("recommendation") ||
    desc.includes("consensus") ||
    (desc.includes("rating") && !desc.includes("analyst rating")) ||
    /recommend\.\w+/i.test(desc);

  if (!returnsRating) return null;

  // Check if it documents the scale
  const hasScale =
    /\d\s*(to|-)\s*\d/.test(desc) ||        // "1 to 5", "-1 to 1"
    /scale|range/i.test(desc) ||
    desc.includes("strong buy") ||
    desc.includes("strong sell") ||
    />.*=|<.*=/.test(desc);                  // "> 1.0 =", "< 0.7 ="

  if (!hasScale) {
    return {
      tool: tool.name,
      module: moduleName,
      check: "value-scale",
      message: "Description returns ratings/recommendations but doesn't document the value scale",
      severity: "warning",
    };
  }
  return null;
}

function checkParamDescriptions(tool: ToolDefinition, moduleName: string): Issue[] {
  const issues: Issue[] = [];
  const shape = getZodObjectShape(tool.inputSchema);
  if (!shape) return issues;

  for (const [paramName, paramSchema] of Object.entries(shape)) {
    if (!hasDescription(paramSchema)) {
      issues.push({
        tool: tool.name,
        module: moduleName,
        check: "param-describe",
        message: `Parameter "${paramName}" missing .describe()`,
        severity: "error",
      });
    }
  }

  return issues;
}

function checkNamePrefix(tool: ToolDefinition, moduleName: string): Issue | null {
  const prefixes = MODULE_PREFIX_MAP[moduleName];
  if (!prefixes) return null;

  const valid = prefixes.some((p) => tool.name.startsWith(p));
  if (!valid) {
    return {
      tool: tool.name,
      module: moduleName,
      check: "name-prefix",
      message: `Tool name should start with one of: ${prefixes.join(", ")}`,
      severity: "error",
    };
  }
  return null;
}

function checkDuplicateNames(allTools: Array<{ tool: ToolDefinition; module: string }>): Issue[] {
  const seen = new Map<string, string>();
  const issues: Issue[] = [];

  for (const { tool, module: moduleName } of allTools) {
    const existing = seen.get(tool.name);
    if (existing) {
      issues.push({
        tool: tool.name,
        module: moduleName,
        check: "duplicate-name",
        message: `Duplicate tool name (also in module "${existing}")`,
        severity: "error",
      });
    } else {
      seen.set(tool.name, moduleName);
    }
  }

  return issues;
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
  ];
}

function validate(): boolean {
  const modules = buildAllModules();
  const allIssues: Issue[] = [];
  const allTools: Array<{ tool: ToolDefinition; module: string }> = [];
  let totalTools = 0;

  console.log();

  for (const mod of modules) {
    const moduleIssues: Issue[] = [];

    for (const tool of mod.tools) {
      totalTools++;
      allTools.push({ tool, module: mod.name });

      // Run per-tool checks
      const lengthIssue = checkDescriptionLength(tool, mod.name);
      if (lengthIssue) moduleIssues.push(lengthIssue);

      const sourceIssue = checkDataSource(tool, mod.name);
      if (sourceIssue) moduleIssues.push(sourceIssue);

      const scaleIssue = checkValueScale(tool, mod.name);
      if (scaleIssue) moduleIssues.push(scaleIssue);

      const paramIssues = checkParamDescriptions(tool, mod.name);
      moduleIssues.push(...paramIssues);

      const prefixIssue = checkNamePrefix(tool, mod.name);
      if (prefixIssue) moduleIssues.push(prefixIssue);
    }

    // Print module results
    const toolNames = mod.tools.map((t) => t.name);

    console.log(`${mod.name} (${mod.tools.length} tools)`);
    for (const name of toolNames) {
      const toolIssues = moduleIssues.filter((i) => i.tool === name);
      if (toolIssues.length === 0) {
        console.log(`  \x1b[32m✓\x1b[0m ${name}`);
      } else {
        for (const issue of toolIssues) {
          const icon = issue.severity === "error" ? "\x1b[31m✗\x1b[0m" : "\x1b[33m⚠\x1b[0m";
          console.log(`  ${icon} ${name} — ${issue.message}`);
        }
      }
    }
    console.log();

    allIssues.push(...moduleIssues);
  }

  // Cross-module checks
  const dupeIssues = checkDuplicateNames(allTools);
  allIssues.push(...dupeIssues);
  if (dupeIssues.length > 0) {
    console.log("Cross-module checks");
    for (const issue of dupeIssues) {
      console.log(`  \x1b[31m✗\x1b[0m ${issue.tool} — ${issue.message}`);
    }
    console.log();
  }

  // Summary
  const errors = allIssues.filter((i) => i.severity === "error");
  const warnings = allIssues.filter((i) => i.severity === "warning");
  const passedCount = totalTools - new Set(allIssues.map((i) => i.tool)).size;

  console.log("─".repeat(50));
  if (errors.length === 0 && warnings.length === 0) {
    console.log(`\x1b[32m✓ All ${totalTools} tools passed validation\x1b[0m`);
  } else {
    console.log(
      `${passedCount}/${totalTools} tools clean` +
        (errors.length > 0 ? `, \x1b[31m${errors.length} errors\x1b[0m` : "") +
        (warnings.length > 0 ? `, \x1b[33m${warnings.length} warnings\x1b[0m` : ""),
    );
  }
  console.log();

  return errors.length === 0;
}

const passed = validate();
process.exit(passed ? 0 : 1);
