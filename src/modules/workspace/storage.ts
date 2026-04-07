import * as fs from "node:fs/promises";
import * as path from "node:path";
import { lock } from "proper-lockfile";
import { Workspace, WorkspaceSchema } from "./types.js";

export interface LoadResult {
  data: Workspace;
  lastModified: number;
}

export class StorageManager {
  private filePath: string;
  private lockPath: string;
  private defaultExchange: string;
  
  constructor(dataDir: string, defaultExchange = "NASDAQ") {
    this.filePath = path.join(dataDir, "workspace.json");
    this.lockPath = path.join(dataDir, ".workspace.lock");
    this.defaultExchange = defaultExchange;
  }

  private async assertNotSymlink(filePath: string): Promise<void> {
    try {
      const stat = await fs.lstat(filePath);
      if (stat.isSymbolicLink()) {
        throw new Error(`Refusing to operate on symlink: ${filePath}`);
      }
    } catch (e: unknown) {
      if (e instanceof Error && "code" in e && (e as NodeJS.ErrnoException).code === "ENOENT") {
        return; // file doesn't exist yet, OK
      }
      throw e;
    }
  }

  async exists(): Promise<boolean> {
    try {
      await fs.access(this.filePath);
      return true;
    } catch {
      return false;
    }
  }

  async load(): Promise<LoadResult> {
    await this.assertNotSymlink(this.filePath);

    if (!(await this.exists())) {
      const defaultData = WorkspaceSchema.parse({
        profile: { defaultExchange: this.defaultExchange },
      });
      return { data: defaultData, lastModified: 0 };
    }

    const fh = await fs.open(this.filePath, "r");
    try {
      const [raw, stat] = await Promise.all([
        fh.readFile("utf-8"),
        fh.stat(),
      ]);

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        throw new Error(`Workspace file corrupted: ${e instanceof Error ? e.message : String(e)}`);
      }

      const data = WorkspaceSchema.parse(parsed);
      return { data, lastModified: stat.mtimeMs };
    } finally {
      await fh.close();
    }
  }

  async save(data: Workspace, expectedLastModified: number): Promise<number> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });

    // Check lock file BEFORE writing to it
    await this.assertNotSymlink(this.lockPath);

    // Ensure lock file exists (safe now — verified not a symlink)
    await fs.writeFile(this.lockPath, "", "utf-8");

    let release: (() => Promise<void>) | undefined;
    let tmpPath: string | undefined;

    try {
      // Acquire lock on the dedicated lock file
      release = await lock(this.lockPath, {
        retries: {
          retries: 5,
          minTimeout: 100,
          maxTimeout: 1000,
        },
      });

      await this.assertNotSymlink(this.filePath);

      const fileExists = await this.exists();

      // P1 Fix: Bootstrap race check
      if (expectedLastModified === 0 && fileExists) {
        throw new Error("Conflict: The workspace was already initialized by another process. Please reload.");
      }

      // P1 Fix: Normal stale writer check
      if (expectedLastModified > 0) {
        if (!fileExists) {
          throw new Error("Conflict: The workspace file has been deleted. Please reload.");
        }
        const stat = await fs.stat(this.filePath);
        if (stat.mtimeMs > expectedLastModified) {
          throw new Error("Conflict: The workspace has been modified by another process. Please reload and try again.");
        }
      }

      tmpPath = `${this.filePath}.tmp`;
      const bakPath = `${this.filePath}.bak`;
      const content = JSON.stringify(data, null, 2);

      // Check tmp/bak paths before writing
      await this.assertNotSymlink(tmpPath);
      await this.assertNotSymlink(bakPath);

      // Atomic write
      await fs.writeFile(tmpPath, content, "utf-8");

      if (fileExists) {
        await fs.copyFile(this.filePath, bakPath);
      }
      
      await fs.rename(tmpPath, this.filePath);
      
      const newStat = await fs.stat(this.filePath);
      return newStat.mtimeMs;
    } finally {
      if (release) {
        await release();
      }
      // Clean up tmp file if it still exists (failed write)
      if (tmpPath) {
        try {
          await fs.unlink(tmpPath);
        } catch {
          // tmp file already renamed or never created — ignore
        }
      }
    }
  }
}
