import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { fileURLToPath } from "node:url";
import {
  discoverSkills,
  resolveDestination,
  parseInstallArgs,
  installSkills,
  runInstallSkills,
} from "../skills-installer.js";
import type { SkillInfo } from "../skills-installer.js";

// Resolve skills dir relative to this test file, not process.cwd()
const __testDir = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(__testDir, "..", "..", "skills");

describe("skills-installer", () => {
  // --- discoverSkills ---

  describe("discoverSkills", () => {
    it("finds all SKILL.md files in the skills directory", () => {
      const skills = discoverSkills(SKILLS_DIR);
      expect(skills.length).toBeGreaterThanOrEqual(16);
      expect(skills.every(s => s.name && s.category && s.srcPath)).toBe(true);
    });

    it("returns category and name from directory structure", () => {
      const skills = discoverSkills(SKILLS_DIR);
      const briefing = skills.find(s => s.name === "morning-briefing");
      expect(briefing).toBeDefined();
      expect(briefing!.category).toBe("daily");
    });

    it("discovers SKILL.md files at both depth 2 and depth 3", () => {
      const skills = discoverSkills(SKILLS_DIR);
      // Verify depth-3 skills exist
      const depth3 = skills.find(s => s.name === "morning-briefing");
      expect(depth3).toBeDefined();
      // All discovered skills should have valid paths
      for (const s of skills) {
        expect(fs.existsSync(s.srcPath)).toBe(true);
      }
    });

    it("filters by category when specified", () => {
      const skills = discoverSkills(SKILLS_DIR, "macro");
      expect(skills.length).toBeGreaterThanOrEqual(3);
      expect(skills.every(s => s.category === "macro")).toBe(true);
    });

    it("returns empty array for unknown category", () => {
      expect(discoverSkills(SKILLS_DIR, "nonexistent")).toEqual([]);
    });

    it("returns empty array for nonexistent directory", () => {
      expect(discoverSkills("/tmp/no-such-dir-xyz-999")).toEqual([]);
    });

    it("extracts description from YAML frontmatter", () => {
      const skills = discoverSkills(SKILLS_DIR);
      const briefing = skills.find(s => s.name === "morning-briefing");
      expect(briefing).toBeDefined();
      expect(briefing!.description.length).toBeGreaterThan(10);
    });

    it("discovers depth-2 skills like market-data", () => {
      const skills = discoverSkills(SKILLS_DIR);
      const marketData = skills.find(s => s.name === "market-data");
      expect(marketData).toBeDefined();
      expect(marketData!.category).toBe("market-data");
    });

    it("has no empty descriptions", () => {
      const skills = discoverSkills(SKILLS_DIR);
      for (const s of skills) {
        expect(s.description.length).toBeGreaterThan(0);
      }
    });
  });

  // --- resolveDestination ---

  describe("resolveDestination", () => {
    it("returns ~/.claude/skills for user scope", () => {
      const dest = resolveDestination("user");
      const expected = path.join(os.homedir(), ".claude", "skills");
      expect(dest).toBe(expected);
    });

    it("returns .claude/skills for project scope", () => {
      const dest = resolveDestination("project");
      expect(dest).toBe(path.join(process.cwd(), ".claude", "skills"));
    });
  });

  // --- parseInstallArgs ---

  describe("parseInstallArgs", () => {
    it("defaults to user scope, no category, no list, no force", () => {
      expect(parseInstallArgs([])).toEqual({ scope: "user", list: false, force: false });
    });

    it("parses --scope project", () => {
      expect(parseInstallArgs(["--scope", "project"]).scope).toBe("project");
    });

    it("parses --category macro", () => {
      expect(parseInstallArgs(["--category", "macro"]).category).toBe("macro");
    });

    it("parses --list", () => {
      expect(parseInstallArgs(["--list"]).list).toBe(true);
    });

    it("parses --force", () => {
      expect(parseInstallArgs(["--force"]).force).toBe(true);
    });

    it("parses combined flags", () => {
      const opts = parseInstallArgs(["--scope", "project", "--category", "daily", "--force"]);
      expect(opts).toEqual({ scope: "project", category: "daily", list: false, force: true });
    });

    it("handles --scope without following value", () => {
      const opts = parseInstallArgs(["--scope"]);
      expect(opts.scope).toBe("user"); // keeps default
    });

    it("handles --category without following value", () => {
      const opts = parseInstallArgs(["--category"]);
      expect(opts.category).toBeUndefined();
    });

    it("ignores invalid scope values, keeps default", () => {
      expect(parseInstallArgs(["--scope", "invalid"]).scope).toBe("user");
    });
  });

  // --- installSkills ---

  describe("installSkills", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-test-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("returns zero counts for empty skills array", async () => {
      const result = await installSkills([], tmpDir, true);
      expect(result).toEqual({ installed: 0, skipped: 0 });
    });

    it("copies SKILL.md files to destination with flat skill-name dirs", async () => {
      const skills = discoverSkills(SKILLS_DIR);
      const result = await installSkills(skills, tmpDir, true);

      expect(result.installed).toBeGreaterThanOrEqual(16);
      expect(result.skipped).toBe(0);

      const installed = fs.readdirSync(tmpDir);
      expect(installed).toContain("morning-briefing");
      expect(installed).toContain("risk-check");

      // Verify byte-identical copy
      const srcContent = fs.readFileSync(skills[0].srcPath, "utf-8");
      const destContent = fs.readFileSync(
        path.join(tmpDir, skills[0].name, "SKILL.md"), "utf-8"
      );
      expect(destContent).toBe(srcContent);
    });

    it("skips existing skills when force=false in non-TTY", async () => {
      const skills = discoverSkills(SKILLS_DIR, "macro");

      // First install
      await installSkills(skills, tmpDir, true);

      // Second install without force — non-TTY returns false from confirm()
      const result = await installSkills(skills, tmpDir, false);
      expect(result.skipped).toBe(skills.length);
      expect(result.installed).toBe(0);
    });

    it("overwrites existing skills when force=true", async () => {
      const skills = discoverSkills(SKILLS_DIR, "macro");

      // First install
      await installSkills(skills, tmpDir, true);

      // Modify a file
      const targetPath = path.join(tmpDir, skills[0].name, "SKILL.md");
      fs.writeFileSync(targetPath, "modified content");

      // Second install with force — should overwrite
      const result = await installSkills(skills, tmpDir, true);
      expect(result.installed).toBe(skills.length);

      // Verify restored from source
      const restored = fs.readFileSync(targetPath, "utf-8");
      const original = fs.readFileSync(skills[0].srcPath, "utf-8");
      expect(restored).toBe(original);
    });
  });

  // --- getSkillsDir ---

  describe("getSkillsDir", () => {
    it("returns a path ending in 'skills'", async () => {
      const { getSkillsDir } = await import("../skills-installer.js");
      const dir = getSkillsDir();
      expect(dir.endsWith("skills")).toBe(true);
    });
  });

  // --- printSkillList ---

  describe("printSkillList", () => {
    it("prints skills grouped by category to stderr", async () => {
      const { printSkillList } = await import("../skills-installer.js");
      const mockError = vi.spyOn(console, "error").mockImplementation(() => {});

      const skills: SkillInfo[] = [
        { name: "skill-a", category: "cat1", srcPath: "/fake/a", description: "Description A" },
        { name: "skill-b", category: "cat1", srcPath: "/fake/b", description: "Description B" },
        { name: "skill-c", category: "cat2", srcPath: "/fake/c", description: "A very long description that exceeds seventy characters and should be truncated with dots" },
      ];

      printSkillList(skills);

      const output = mockError.mock.calls.map((c: unknown[]) => c[0]).join("\n");
      expect(output).toContain("3 total");
      expect(output).toContain("cat1/");
      expect(output).toContain("cat2/");
      expect(output).toContain("/skill-a");
      expect(output).toContain("/skill-c");
      // Verify truncation
      expect(output).toContain("...");

      mockError.mockRestore();
    });
  });

  // --- runInstallSkills ---

  describe("runInstallSkills", () => {
    let tmpDir: string;
    let mockExit: ReturnType<typeof vi.spyOn>;
    let mockError: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-run-test-"));
      mockExit = vi.spyOn(process, "exit").mockImplementation((() => {
        throw new Error("process.exit called");
      }) as never);
      mockError = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      mockExit.mockRestore();
      mockError.mockRestore();
    });

    it("lists skills with --list flag without installing", async () => {
      await runInstallSkills(["--list"]);

      const output = mockError.mock.calls.map((c: unknown[]) => c[0]).join("\n");
      expect(output).toContain("Available skills");
      expect(output).toContain("/morning-briefing");
      // Should not have called process.exit
      expect(mockExit).not.toHaveBeenCalled();
    });

    it("installs skills with --force --scope project", async () => {
      // Override cwd so project scope writes to our temp dir
      const originalCwd = process.cwd;
      process.cwd = () => tmpDir;

      try {
        await runInstallSkills(["--scope", "project", "--force"]);
      } finally {
        process.cwd = originalCwd;
      }

      const installed = fs.readdirSync(path.join(tmpDir, ".claude", "skills"));
      expect(installed).toContain("morning-briefing");
      expect(installed).toContain("risk-check");
    });

    it("exits with error for invalid category", async () => {
      await expect(
        runInstallSkills(["--category", "nonexistent-category-xyz"])
      ).rejects.toThrow("process.exit called");

      expect(mockExit).toHaveBeenCalledWith(1);
      const output = mockError.mock.calls.map((c: unknown[]) => c[0]).join("\n");
      expect(output).toContain("No skills found in category");
    });

    it("filters by category with --category", async () => {
      await runInstallSkills(["--list", "--category", "macro"]);

      const output = mockError.mock.calls.map((c: unknown[]) => c[0]).join("\n");
      expect(output).toContain("macro/");
      // Should not contain other categories
      expect(output).not.toContain("daily/");
    });
  });

  // --- install-skills entry point ---

  describe("install-skills entry point", () => {
    it("built artifact exists and runs --list successfully", async () => {
      const { execFile } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const execFileAsync = promisify(execFile);

      const entryPath = path.join(__testDir, "..", "..", "dist", "install-skills.js");

      // Skip if not built yet (CI builds before testing)
      if (!fs.existsSync(entryPath)) return;

      const { stderr } = await execFileAsync("node", [entryPath, "--list"]);
      expect(stderr).toContain("Available skills");
      expect(stderr).toContain("/morning-briefing");
    });
  });
});
