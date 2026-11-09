import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { ZodError } from "zod";
import { DatabaseManager, assertNotSymlinkSync, isSqliteBusyError } from "../../shared/db.js";
import { RESERVED_KEYS, Workspace, WorkspaceSchema } from "./types.js";
import {
  createWorkspaceSchema,
  readMeta,
  readProfileVersion,
  readWorkspace,
  writeMeta,
  writeWorkspace,
} from "./schema.js";

export interface LoadResult {
  data: Workspace;
  version: number;
}

export interface StorageOptions {
  busyTimeoutMs?: number;
}

export const WORKSPACE_DB_FILE = "workspace.db";
export const LEGACY_WORKSPACE_FILE = "workspace.json";
const MIRROR_MTIME_KEY = "mirror_mtime_ms";
const MIRROR_SHA256_KEY = "mirror_sha256";

const BUSY_MESSAGE =
  "Conflict: The workspace is locked by another stock-scanner process (a second session or the sidecar). Please retry.";

function findReservedKeys(parsed: unknown): string[] {
  if (typeof parsed !== "object" || parsed === null) return [];
  const found: string[] = [];
  for (const section of ["watchlists", "theses"] as const) {
    const record = (parsed as Record<string, unknown>)[section];
    if (typeof record !== "object" || record === null) continue;
    for (const key of Object.keys(record)) {
      if (RESERVED_KEYS.has(key)) found.push(`${section}.${key}`);
    }
  }
  return found;
}

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function isErrno(e: unknown, code: string): boolean {
  return e instanceof Error && "code" in e && (e as NodeJS.ErrnoException).code === code;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export class StorageManager {
  private readonly dbManager: DatabaseManager;
  private readonly legacyPath: string;
  private readonly defaultExchange: string;
  private ready = false;
  private readying: Promise<void> | null = null;
  private generation = 0;
  private ignoredLegacyMtime: number | null = null;

  constructor(dataDir: string, defaultExchange = "NASDAQ", options: StorageOptions = {}) {
    this.dbManager = new DatabaseManager(dataDir, { fileName: WORKSPACE_DB_FILE, busyTimeoutMs: options.busyTimeoutMs });
    this.legacyPath = path.join(dataDir, LEGACY_WORKSPACE_FILE);
    this.defaultExchange = defaultExchange;
  }

  get dbPath(): string {
    return this.dbManager.dbPath;
  }

  private async ensureReady(): Promise<void> {
    if (this.ready) return;
    if (!this.readying) {
      const generation = this.generation;
      this.readying = this.dbManager
        .open()
        .then(() => {
          if (generation !== this.generation) throw new Error("Workspace storage was closed while opening");
          this.withBusyMapping(() => this.dbManager.transaction("IMMEDIATE", createWorkspaceSchema));
          this.ready = true;
        })
        .finally(() => {
          this.readying = null;
        });
    }
    await this.readying;
  }

  private withBusyMapping<T>(fn: () => T): T {
    try {
      return fn();
    } catch (e) {
      if (isSqliteBusyError(e)) throw new Error(BUSY_MESSAGE);
      throw e;
    }
  }

  private statLegacyMtime(): number | null {
    assertNotSymlinkSync(this.legacyPath);
    try {
      const stat = fs.statSync(this.legacyPath);
      if (!stat.isFile()) throw new Error(`Workspace file invalid (${this.legacyPath}): not a regular file`);
      return stat.mtimeMs;
    } catch (e) {
      if (isErrno(e, "ENOENT")) return null;
      throw e;
    }
  }

  private parseLegacyWorkspace(raw: string): Workspace {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new Error(`Workspace file corrupted (${this.legacyPath}): ${errorMessage(e)}`);
    }
    // zod's record parser silently drops keys like __proto__; reject them explicitly instead.
    const reserved = findReservedKeys(parsed);
    if (reserved.length > 0) {
      throw new Error(`Workspace file invalid (${this.legacyPath}): contains reserved key(s) ${reserved.join(", ")}`);
    }
    try {
      return WorkspaceSchema.parse(parsed);
    } catch (e) {
      const detail = e instanceof ZodError ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : String(e);
      throw new Error(`Workspace file invalid (${this.legacyPath}): ${detail}`);
    }
  }

  // Imports workspace.json when the database is empty, or when the file changed after our
  // last mirror write (an older release or the user edited it). Runs before every load/save
  // so a long-lived session cannot overwrite edits made by another release in the meantime.
  private syncFromLegacy(): void {
    const legacyMtime = this.statLegacyMtime();
    if (legacyMtime === null) return;

    this.withBusyMapping(() =>
      this.dbManager.transaction("IMMEDIATE", (db) => {
        const current = readProfileVersion(db);
        const recorded = readMeta(db, MIRROR_MTIME_KEY);
        const recordedMtime = recorded === null ? Number.NaN : Number(recorded);
        // Strictly older only; an equal mtime (coarse-grained filesystems) falls through to the hash check.
        if (current !== null && Number.isFinite(recordedMtime) && legacyMtime < recordedMtime) return;

        const raw = fs.readFileSync(this.legacyPath, "utf-8");
        const hash = sha256(raw);
        if (current !== null && hash === readMeta(db, MIRROR_SHA256_KEY)) {
          // Touched (backup restore, cloud sync) but identical to what we last wrote.
          writeMeta(db, MIRROR_MTIME_KEY, String(legacyMtime));
          return;
        }

        let legacy: Workspace;
        try {
          legacy = this.parseLegacyWorkspace(raw);
        } catch (e) {
          if (current === null) throw e;
          if (this.ignoredLegacyMtime !== legacyMtime) {
            this.ignoredLegacyMtime = legacyMtime;
            console.error(
              `[workspace] Ignoring ${this.legacyPath}: ${errorMessage(e)}. ` +
                `Using ${this.dbManager.dbPath} as-is; fix or remove the file to stop this warning.`,
            );
          }
          return;
        }

        const version = (current ?? 0) + 1;
        writeWorkspace(db, legacy, version);
        writeMeta(db, MIRROR_MTIME_KEY, String(legacyMtime));
        writeMeta(db, MIRROR_SHA256_KEY, hash);
        console.error(
          current === null
            ? `[workspace] Imported ${this.legacyPath} into ${this.dbManager.dbPath}. The JSON file is kept up to date as a mirror.`
            : `[workspace] ${this.legacyPath} changed since the last mirror write (older release or manual edit); re-imported it as version ${version}.`,
        );
      }),
    );
  }

  async load(): Promise<LoadResult> {
    await this.ensureReady();
    this.syncFromLegacy();
    const stored = this.withBusyMapping(() => this.dbManager.transaction("DEFERRED", readWorkspace));
    if (stored) return { data: stored.data, version: stored.version };
    return {
      data: WorkspaceSchema.parse({ profile: { defaultExchange: this.defaultExchange } }),
      version: 0,
    };
  }

  async save(data: Workspace, expectedVersion: number): Promise<number> {
    await this.ensureReady();
    this.syncFromLegacy();

    const content = JSON.stringify(data, null, 2);
    const tmpPath = `${this.legacyPath}.${process.pid}.tmp`;

    let next: number;
    try {
      next = this.withBusyMapping(() =>
      this.dbManager.transaction("IMMEDIATE", (db) => {
        const current = readProfileVersion(db);

        if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
          throw new Error(`Conflict: Invalid workspace version ${String(expectedVersion)}. Please reload.`);
        }
        if (expectedVersion === 0 && current !== null) {
          throw new Error("Conflict: The workspace was already initialized by another process. Please reload.");
        }
        if (expectedVersion > 0) {
          if (current === null) {
            throw new Error("Conflict: The workspace has been reset by another process. Please reload.");
          }
          if (current !== expectedVersion) {
            throw new Error("Conflict: The workspace has been modified by another process. Please reload and try again.");
          }
        }

        const version = (current ?? 0) + 1;
        writeWorkspace(db, data, version);
        this.writeMirrorTemp(tmpPath, content);
        return version;
      }),
      );
    } catch (e) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // nothing was staged
      }
      throw e;
    }

    this.publishMirror(tmpPath, content, next);
    return next;
  }

  // The mirror keeps workspace.json readable by releases that predate SQLite storage.
  // Phase 1 (under the write lock): stage the content in a per-process temp file.
  private writeMirrorTemp(tmpPath: string, content: string): void {
    try {
      assertNotSymlinkSync(tmpPath);
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // no stale temp file from a previous crash
      }
      fs.writeFileSync(tmpPath, content, { encoding: "utf-8", mode: 0o600, flag: "wx" });
    } catch (e) {
      console.error(`[workspace] Could not stage ${this.legacyPath} mirror: ${errorMessage(e)}`);
    }
  }

  // Phase 2 (after COMMIT, in its own short write transaction): publish the temp file only if
  // no other process has committed a newer version since; a failed COMMIT never reaches here,
  // so the mirror can never hold data the database rejected. Best effort: never fails the save.
  private publishMirror(tmpPath: string, content: string, version: number): void {
    try {
      if (!fs.lstatSync(tmpPath).isFile()) return;
    } catch {
      return; // staging failed earlier and was already reported
    }
    try {
      this.dbManager.transaction("IMMEDIATE", (db) => {
        if (readProfileVersion(db) !== version) {
          fs.unlinkSync(tmpPath);
          return;
        }
        assertNotSymlinkSync(this.legacyPath);
        fs.renameSync(tmpPath, this.legacyPath);
        writeMeta(db, MIRROR_MTIME_KEY, String(fs.statSync(this.legacyPath).mtimeMs));
        writeMeta(db, MIRROR_SHA256_KEY, sha256(content));
      });
    } catch (e) {
      console.error(`[workspace] Could not update ${this.legacyPath} mirror: ${errorMessage(e)}`);
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // already renamed or never created
      }
    }
  }

  close(): void {
    this.generation++;
    this.dbManager.close();
    this.ready = false;
  }
}
