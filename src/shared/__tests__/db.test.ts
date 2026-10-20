import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { DatabaseSync } from "node:sqlite";
import { DatabaseManager, assertNotSymlinkSync, isSqliteBusyError } from "../db.js";

describe("DatabaseManager", () => {
  let tmpDir: string;
  const managers: DatabaseManager[] = [];

  function make(options: Partial<ConstructorParameters<typeof DatabaseManager>[1]> = {}): DatabaseManager {
    const m = new DatabaseManager(tmpDir, { fileName: "workspace.db", ...options });
    managers.push(m);
    return m;
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "db-test-"));
  });

  afterEach(() => {
    for (const m of managers.splice(0)) m.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates the data dir and database lazily on open() with WAL and foreign keys", async () => {
    const nested = path.join(tmpDir, "a", "b");
    const m = new DatabaseManager(nested, { fileName: "workspace.db" });
    managers.push(m);
    expect(fs.existsSync(nested)).toBe(false);
    expect(m.isOpen()).toBe(false);

    const db = await m.open();
    expect(m.isOpen()).toBe(true);
    expect(fs.existsSync(m.dbPath)).toBe(true);
    expect((db.prepare("PRAGMA journal_mode").get() as { journal_mode: string }).journal_mode).toBe("wal");
    expect((db.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number }).foreign_keys).toBe(1);
  });

  it("open() is idempotent and returns the same connection", async () => {
    const m = make();
    const [a, b] = await Promise.all([m.open(), m.open()]);
    expect(a).toBe(b);
    expect(await m.open()).toBe(a);
  });

  it("refuses to open when the database path is a symlink", async () => {
    fs.writeFileSync(path.join(tmpDir, "target.db"), "");
    fs.symlinkSync(path.join(tmpDir, "target.db"), path.join(tmpDir, "workspace.db"));
    await expect(make().open()).rejects.toThrow("symlink");
  });

  it("refuses to open when a dangling symlink sits at the database path", async () => {
    fs.symlinkSync(path.join(tmpDir, "does-not-exist.db"), path.join(tmpDir, "workspace.db"));
    await expect(make().open()).rejects.toThrow("symlink");
    expect(fs.existsSync(path.join(tmpDir, "does-not-exist.db"))).toBe(false);
  });

  it("refuses to open when the -wal sibling is a symlink", async () => {
    fs.writeFileSync(path.join(tmpDir, "target"), "");
    fs.symlinkSync(path.join(tmpDir, "target"), path.join(tmpDir, "workspace.db-wal"));
    await expect(make().open()).rejects.toThrow("symlink");
  });

  it("transaction() commits on success and rolls back on error", async () => {
    const m = make();
    const db = await m.open();
    db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY)");

    const result = m.transaction("IMMEDIATE", (d) => {
      d.prepare("INSERT INTO t (id) VALUES (1)").run();
      return "ok";
    });
    expect(result).toBe("ok");

    expect(() =>
      m.transaction("IMMEDIATE", (d) => {
        d.prepare("INSERT INTO t (id) VALUES (2)").run();
        throw new Error("boom");
      }),
    ).toThrow("boom");

    const rows = db.prepare("SELECT id FROM t ORDER BY id").all() as Array<{ id: number }>;
    expect(rows.map((r) => r.id)).toEqual([1]);
  });

  it("surfaces SQLITE_BUSY when another connection holds the write lock", async () => {
    const m = make({ busyTimeoutMs: 50 });
    const db = await m.open();
    db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY)");

    const other = new DatabaseSync(m.dbPath);
    other.exec("BEGIN IMMEDIATE");
    try {
      let caught: unknown;
      try {
        m.transaction("IMMEDIATE", (d) => d.prepare("INSERT INTO t (id) VALUES (1)").run());
      } catch (e) {
        caught = e;
      }
      expect(isSqliteBusyError(caught)).toBe(true);
    } finally {
      other.exec("ROLLBACK");
      other.close();
    }
  });

  it("close() releases the connection so the file can be reopened", async () => {
    const m = make();
    await m.open();
    m.close();
    expect(m.isOpen()).toBe(false);
    expect(() => m.get()).toThrow("not open");
    await m.open();
    expect(m.isOpen()).toBe(true);
  });

  it("close() during an in-flight open() closes the connection once it lands", async () => {
    const m = make();
    const opening = m.open();
    m.close();
    await opening;
    await new Promise((r) => setImmediate(r));
    expect(m.isOpen()).toBe(false);
  });

  it("falls back to the default busy timeout for invalid values", async () => {
    const m = make({ busyTimeoutMs: Number.NaN });
    const db = await m.open();
    expect((db.prepare("PRAGMA busy_timeout").get() as { timeout: number }).timeout).toBe(5000);
  });
});

describe("assertNotSymlinkSync", () => {
  it("passes for missing files and regular files, rejects symlinks", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "symlink-test-"));
    try {
      expect(() => assertNotSymlinkSync(path.join(dir, "missing"))).not.toThrow();
      fs.writeFileSync(path.join(dir, "regular"), "");
      expect(() => assertNotSymlinkSync(path.join(dir, "regular"))).not.toThrow();
      fs.symlinkSync(path.join(dir, "regular"), path.join(dir, "link"));
      expect(() => assertNotSymlinkSync(path.join(dir, "link"))).toThrow("symlink");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("isSqliteBusyError", () => {
  it("recognises busy/locked errors by errcode or message and rejects others", () => {
    expect(isSqliteBusyError(Object.assign(new Error("x"), { errcode: 5 }))).toBe(true);
    expect(isSqliteBusyError(Object.assign(new Error("x"), { errcode: 6 }))).toBe(true);
    expect(isSqliteBusyError(new Error("database is locked"))).toBe(true);
    expect(isSqliteBusyError(new Error("CHECK constraint failed"))).toBe(false);
    expect(isSqliteBusyError("database is locked")).toBe(false);
  });
});
