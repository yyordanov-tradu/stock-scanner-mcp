#!/usr/bin/env tsx
/**
 * Validate that tool names referenced in skill and command markdown exist.
 *
 * Scans backticked identifiers such as `tradingview_quote` and fails when the
 * name looks like an MCP tool but is not registered by the current code.
 *
 * Usage: npm run validate-doc-tools
 */

import { promises as fs } from "node:fs";
import * as path from "node:path";
import { getRegisteredToolNames, getRegisteredToolPrefixes } from "./tool-registry.js";

const DEFAULT_ROOTS = ["skills", "commands"];
const TOOL_REFERENCE_PATTERN = /`([a-z][a-z0-9]*(?:_[a-z0-9]+)+)`/g;

export interface UnknownToolReference {
  file: string;
  line: number;
  column: number;
  name: string;
  suggestion?: string;
}

interface ScanResult {
  markdownFiles: number;
  toolReferences: number;
  unknownReferences: UnknownToolReference[];
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function collectMarkdownFiles(root: string): Promise<string[]> {
  if (!(await pathExists(root))) return [];

  const stat = await fs.stat(root);
  if (stat.isFile()) {
    return root.endsWith(".md") ? [root] : [];
  }

  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = await Promise.all(entries.map(async entry => {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) return collectMarkdownFiles(fullPath);
    return entry.isFile() && entry.name.endsWith(".md") ? [fullPath] : [];
  }));

  return files.flat().sort();
}

function lineAndColumn(content: string, index: number): { line: number; column: number } {
  const before = content.slice(0, index);
  const lines = before.split("\n");
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

function editDistance(left: string, right: string): number {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const costs = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i++) costs[i][0] = i;
  for (let j = 0; j < cols; j++) costs[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const substitution = costs[i - 1][j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1);
      costs[i][j] = Math.min(
        costs[i - 1][j] + 1,
        costs[i][j - 1] + 1,
        substitution,
      );
    }
  }

  return costs[left.length][right.length];
}

function suggestToolName(name: string, registeredTools: Set<string>): string | undefined {
  let best: { name: string; distance: number } | undefined;

  for (const tool of registeredTools) {
    const distance = editDistance(name, tool);
    if (!best || distance < best.distance) {
      best = { name: tool, distance };
    }
  }

  if (!best) return undefined;
  const threshold = Math.max(4, Math.floor(name.length * 0.4));
  return best.distance <= threshold ? best.name : undefined;
}

function isToolLikeReference(name: string, knownPrefixes: Set<string>): boolean {
  const prefix = name.split("_")[0];
  return knownPrefixes.has(prefix);
}

export async function validateDocToolReferences(roots = DEFAULT_ROOTS): Promise<ScanResult> {
  const registeredTools = getRegisteredToolNames();
  const knownPrefixes = getRegisteredToolPrefixes(registeredTools);
  const files = (await Promise.all(roots.map(collectMarkdownFiles))).flat().sort();
  const unknownReferences: UnknownToolReference[] = [];
  let toolReferences = 0;

  for (const file of files) {
    const content = await fs.readFile(file, "utf8");
    const seenInFile = new Set<string>();

    for (const match of content.matchAll(TOOL_REFERENCE_PATTERN)) {
      const name = match[1];
      if (!isToolLikeReference(name, knownPrefixes)) continue;

      toolReferences++;
      if (registeredTools.has(name)) continue;

      const dedupeKey = `${file}:${name}`;
      if (seenInFile.has(dedupeKey)) continue;
      seenInFile.add(dedupeKey);

      const location = lineAndColumn(content, match.index ?? 0);
      unknownReferences.push({
        file,
        name,
        line: location.line,
        column: location.column,
        suggestion: suggestToolName(name, registeredTools),
      });
    }
  }

  return {
    markdownFiles: files.length,
    toolReferences,
    unknownReferences,
  };
}

async function main(): Promise<void> {
  const result = await validateDocToolReferences();

  console.log("\n\u001b[1m\u001b[36mStock Scanner Doc Tool Reference Validator\u001b[0m");
  console.log("──────────────────────────────────────────────────");
  console.log(`Scanned ${result.markdownFiles} markdown files under ${DEFAULT_ROOTS.join(", ")}.`);

  if (result.unknownReferences.length === 0) {
    console.log(`\n\u001b[32m\u001b[1m✓ All ${result.toolReferences} MCP tool references are registered\u001b[0m\n`);
    return;
  }

  console.log(`\n\u001b[31m\u001b[1m✗ Unknown MCP tool references found:\u001b[0m`);
  for (const issue of result.unknownReferences) {
    const suggestion = issue.suggestion ? ` Did you mean \`${issue.suggestion}\`?` : "";
    console.log(`  ${issue.file}:${issue.line}:${issue.column} \`${issue.name}\` is not registered.${suggestion}`);
  }
  console.log();
  process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
