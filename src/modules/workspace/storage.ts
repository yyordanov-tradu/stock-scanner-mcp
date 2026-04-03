import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Workspace, WorkspaceSchema } from "./types.js";

export interface LoadResult {
  data: Workspace;
  lastModified: number;
}

export class StorageManager {
  private filePath: string;
  
  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, "workspace.json");
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
    if (!(await this.exists())) {
      const defaultData = WorkspaceSchema.parse({
        schemaVersion: 1,
        profile: {
          defaultExchange: "NASDAQ",
          assetFocus: [],
          workflowCadence: "daily",
          updatedAt: new Date().toISOString(),
        },
        watchlists: {},
        theses: {},
      });
      return { data: defaultData, lastModified: 0 };
    }

    const raw = await fs.readFile(this.filePath, "utf-8");
    const stat = await fs.stat(this.filePath);
    
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new Error(`Workspace file corrupted: ${e instanceof Error ? e.message : String(e)}`);
    }

    const data = WorkspaceSchema.parse(parsed);
    return { data, lastModified: stat.mtimeMs };
  }

  async save(data: Workspace, expectedLastModified: number): Promise<number> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });

    if (expectedLastModified > 0 && (await this.exists())) {
      const stat = await fs.stat(this.filePath);
      if (stat.mtimeMs > expectedLastModified) {
        throw new Error("Conflict: The workspace has been modified by another process. Please reload and try again.");
      }
    }

    const tmpPath = `${this.filePath}.tmp`;
    const bakPath = `${this.filePath}.bak`;
    const content = JSON.stringify(data, null, 2);

    // Atomic write
    await fs.writeFile(tmpPath, content, "utf-8");
    
    if (await this.exists()) {
      await fs.copyFile(this.filePath, bakPath);
    }
    
    await fs.rename(tmpPath, this.filePath);
    
    const newStat = await fs.stat(this.filePath);
    return newStat.mtimeMs;
  }
}
