// All CLI output uses stderr — stdout is reserved for MCP JSON-RPC protocol.
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as readline from "node:readline";
import { fileURLToPath } from "node:url";

export interface SkillInfo {
  name: string;
  category: string;
  srcPath: string;
  description: string;
}

export interface InstallOptions {
  scope: "user" | "project";
  category?: string;
  list: boolean;
  force: boolean;
}

/**
 * Parse description from SKILL.md YAML frontmatter.
 * Falls back to the skill name if regex doesn't match.
 */
function parseDescription(content: string, fallbackName: string): string {
  const match = content.match(/^description:\s*(.+)$/m);
  if (!match) {
    console.error(`  Warning: no description in frontmatter for skill "${fallbackName}"`);
    return fallbackName;
  }
  let desc = match[1].trim();
  if ((desc.startsWith('"') && desc.endsWith('"')) || (desc.startsWith("'") && desc.endsWith("'"))) {
    desc = desc.slice(1, -1);
  }
  return desc || fallbackName;
}

/**
 * Discover all SKILL.md files under the skills directory.
 * Supports both layouts:
 *   - depth 3: skills/<category>/<skill-name>/SKILL.md
 *   - depth 2: skills/<category-or-name>/SKILL.md
 */
export function discoverSkills(skillsDir: string, category?: string): SkillInfo[] {
  const skills: SkillInfo[] = [];

  if (!fs.existsSync(skillsDir)) return skills;

  const topEntries = fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter((d: fs.Dirent) => d.isDirectory());

  for (const topEntry of topEntries) {
    if (category && topEntry.name !== category) continue;

    const topDir = path.join(skillsDir, topEntry.name);

    // Check depth-3: subdirectories containing SKILL.md
    const subEntries = fs.readdirSync(topDir, { withFileTypes: true })
      .filter((d: fs.Dirent) => d.isDirectory());

    for (const subEntry of subEntries) {
      const skillPath = path.join(topDir, subEntry.name, "SKILL.md");
      if (!fs.existsSync(skillPath)) continue;

      const content = fs.readFileSync(skillPath, "utf-8");
      skills.push({
        name: subEntry.name,
        category: topEntry.name,
        srcPath: skillPath,
        description: parseDescription(content, subEntry.name),
      });
    }

    // Check depth-2: SKILL.md directly in this directory
    const directSkillPath = path.join(topDir, "SKILL.md");
    if (fs.existsSync(directSkillPath)) {
      const content = fs.readFileSync(directSkillPath, "utf-8");
      skills.push({
        name: topEntry.name,
        category: topEntry.name,
        srcPath: directSkillPath,
        description: parseDescription(content, topEntry.name),
      });
    }
  }

  // Detect duplicate skill names (flat install would overwrite)
  const seen = new Set<string>();
  for (const skill of skills) {
    if (seen.has(skill.name)) {
      console.error(`  Warning: duplicate skill name "${skill.name}" (${skill.category}/${skill.name}) — last one wins during install`);
    }
    seen.add(skill.name);
  }

  return skills.sort((a, b) =>
    a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
  );
}

/**
 * Resolve the destination directory based on scope.
 */
export function resolveDestination(scope: "user" | "project"): string {
  if (scope === "user") {
    return path.join(os.homedir(), ".claude", "skills");
  }
  return path.join(process.cwd(), ".claude", "skills");
}

/**
 * Get the bundled skills directory path.
 * Uses inline import.meta.url instead of module-scope __dirname.
 * In the tsup bundle, import.meta.url resolves to dist/index.js for all inlined modules,
 * so ../skills correctly reaches the package root's skills/ directory.
 */
export function getSkillsDir(): string {
  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  return path.join(thisDir, "..", "skills");
}

/**
 * Parse CLI args for install-skills command.
 */
export function parseInstallArgs(args: string[]): InstallOptions {
  const opts: InstallOptions = {
    scope: "user",
    list: false,
    force: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--scope" && args[i + 1]) {
      const val = args[i + 1];
      if (val === "user" || val === "project") {
        opts.scope = val;
      }
      i++;
    } else if (args[i] === "--category" && args[i + 1]) {
      opts.category = args[i + 1];
      i++;
    } else if (args[i] === "--list") {
      opts.list = true;
    } else if (args[i] === "--force") {
      opts.force = true;
    }
  }

  return opts;
}

/**
 * Prompt user for yes/no confirmation.
 * Returns false in non-TTY environments to prevent hanging.
 */
async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    console.error("  (non-interactive — skipping, use --force to overwrite)");
    return false;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  return new Promise(resolve => {
    rl.question(question, (answer: string) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith("y"));
    });
  });
}

/**
 * Install skills to the destination directory.
 * Flat layout: destDir/skill-name/SKILL.md
 * Claude Code discovers skills at ~/.claude/skills/name/SKILL.md (depth 1).
 */
export async function installSkills(
  skills: SkillInfo[],
  destDir: string,
  force: boolean,
): Promise<{ installed: number; skipped: number }> {
  let installed = 0;
  let skipped = 0;

  for (const skill of skills) {
    const destPath = path.join(destDir, skill.name, "SKILL.md");

    if (fs.existsSync(destPath) && !force) {
      const overwrite = await confirm(
        `  Skill "${skill.name}" already exists. Overwrite? [y/N] `,
      );
      if (!overwrite) {
        skipped++;
        continue;
      }
    }

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(skill.srcPath, destPath);
    installed++;
  }

  return { installed, skipped };
}

/**
 * Format and print the skill listing to stderr.
 */
export function printSkillList(skills: SkillInfo[]): void {
  const byCategory = new Map<string, SkillInfo[]>();
  for (const s of skills) {
    if (!byCategory.has(s.category)) byCategory.set(s.category, []);
    byCategory.get(s.category)!.push(s);
  }

  console.error(`\n  Available skills (${skills.length} total):\n`);
  for (const [cat, catSkills] of byCategory) {
    console.error(`  ${cat}/`);
    for (const s of catSkills) {
      const desc = s.description.length > 70
        ? s.description.slice(0, 67) + "..."
        : s.description;
      console.error(`    /${s.name}  ${desc}`);
    }
    console.error("");
  }
}

/**
 * Main entry point for the install-skills command.
 */
export async function runInstallSkills(args: string[]): Promise<void> {
  const opts = parseInstallArgs(args);
  const skillsDir = getSkillsDir();

  if (!fs.existsSync(skillsDir)) {
    console.error("Error: Skills directory not found. This package may not include skills.");
    process.exit(1);
  }

  const allSkills = discoverSkills(skillsDir);
  const skills = opts.category
    ? allSkills.filter(s => s.category === opts.category)
    : allSkills;

  if (skills.length === 0) {
    if (opts.category) {
      const categories = [...new Set(allSkills.map(s => s.category))].sort();
      console.error(`No skills found in category "${opts.category}".`);
      console.error(`Available categories: ${categories.join(", ")}`);
    } else {
      console.error("No skills found.");
    }
    process.exit(1);
  }

  if (opts.list) {
    printSkillList(skills);
    return;
  }

  const destDir = resolveDestination(opts.scope);
  const scopeLabel = opts.scope === "user"
    ? `~/.claude/skills/`
    : `.claude/skills/`;

  console.error(`\n  Installing ${skills.length} skills to ${scopeLabel}\n`);

  const { installed, skipped } = await installSkills(skills, destDir, opts.force);

  console.error(`\n  Done: ${installed} installed, ${skipped} skipped.`);
  if (skills.length > 0) {
    console.error(`  Run /${skills[0].name} in Claude Code to try it out.\n`);
  }
}
