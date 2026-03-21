#!/usr/bin/env tsx
/**
 * Module structure validator.
 *
 * For each module in src/modules/, checks:
 *   1. index.ts exists
 *   2. Source file(s) exist (client.ts, scanner.ts, etc.)
 *   3. __tests__/*.test.ts exists
 *   4. index.ts exports a create*Module function
 *
 * Exit 0 = all pass, Exit 1 = failures found.
 *
 * Usage:  npm run validate-structure
 */

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, basename } from "node:path";

const MODULES_DIR = join(import.meta.dirname, "..", "modules");

interface CheckResult {
  module: string;
  checks: Array<{ name: string; passed: boolean; message: string }>;
}

function validateModule(modulePath: string): CheckResult {
  const moduleName = basename(modulePath);
  const checks: CheckResult["checks"] = [];

  // 1. index.ts exists
  const indexPath = join(modulePath, "index.ts");
  const hasIndex = existsSync(indexPath);
  checks.push({
    name: "index.ts",
    passed: hasIndex,
    message: hasIndex ? "exists" : "missing",
  });

  // 2. Source file exists (client.ts or equivalent like scanner.ts, cboe.ts)
  const allFiles = readdirSync(modulePath);
  const sourceFiles = allFiles.filter(
    (f) => f.endsWith(".ts") && f !== "index.ts",
  );
  const hasSource = sourceFiles.length > 0;
  checks.push({
    name: "source file(s)",
    passed: hasSource,
    message: hasSource ? sourceFiles.join(", ") : "no source files besides index.ts",
  });

  // 3. __tests__/ directory with at least one test file
  const testsDir = join(modulePath, "__tests__");
  const hasTestsDir = existsSync(testsDir) && statSync(testsDir).isDirectory();
  const testFiles = hasTestsDir
    ? readdirSync(testsDir).filter((f) => f.endsWith(".test.ts"))
    : [];
  const hasTests = testFiles.length > 0;
  checks.push({
    name: "__tests__/*.test.ts",
    passed: hasTests,
    message: hasTests ? testFiles.join(", ") : "no test files found",
  });

  // 4. index.ts exports a create*Module function
  if (hasIndex) {
    const content = readFileSync(indexPath, "utf-8");
    const hasFactory = /export\s+function\s+create\w+Module\s*\(/.test(content);
    checks.push({
      name: "create*Module export",
      passed: hasFactory,
      message: hasFactory
        ? "found"
        : "index.ts does not export a create*Module function",
    });
  } else {
    checks.push({
      name: "create*Module export",
      passed: false,
      message: "skipped (no index.ts)",
    });
  }

  return { module: moduleName, checks };
}

function main(): void {
  const entries = readdirSync(MODULES_DIR).filter((name) =>
    statSync(join(MODULES_DIR, name)).isDirectory(),
  );

  if (entries.length === 0) {
    console.error("No modules found in src/modules/");
    process.exit(1);
  }

  console.log();

  let hasFailures = false;

  for (const entry of entries.sort()) {
    const result = validateModule(join(MODULES_DIR, entry));
    const allPassed = result.checks.every((c) => c.passed);

    if (!allPassed) hasFailures = true;

    console.log(`${result.module}`);
    for (const check of result.checks) {
      const icon = check.passed
        ? "\x1b[32m✓\x1b[0m"
        : "\x1b[31m✗\x1b[0m";
      console.log(`  ${icon} ${check.name} — ${check.message}`);
    }
    console.log();
  }

  console.log("─".repeat(50));
  if (hasFailures) {
    console.log("\x1b[31m✗ Structure validation failed\x1b[0m");
  } else {
    console.log(
      `\x1b[32m✓ All ${entries.length} modules passed structure validation\x1b[0m`,
    );
  }
  console.log();

  process.exit(hasFailures ? 1 : 0);
}

main();
