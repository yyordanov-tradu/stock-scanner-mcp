import type { DatabaseSync } from "node:sqlite";
import { ZodError } from "zod";
import { Workspace, WorkspaceSchema, Instrument, Watchlist, Thesis, Profile } from "./types.js";

export const WORKSPACE_DDL = `
  CREATE TABLE IF NOT EXISTS workspace_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    default_exchange TEXT NOT NULL DEFAULT 'NASDAQ',
    trading_style TEXT,
    asset_focus TEXT NOT NULL DEFAULT '[]',
    preferred_timeframe TEXT,
    workflow_cadence TEXT NOT NULL DEFAULT 'daily',
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS workspace_watchlists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS workspace_watchlist_instruments (
    watchlist_id TEXT NOT NULL,
    full TEXT NOT NULL,
    ticker TEXT NOT NULL,
    exchange TEXT,
    is_crypto INTEGER NOT NULL CHECK (is_crypto IN (0, 1)),
    input TEXT NOT NULL,
    note TEXT,
    added_at TEXT NOT NULL,
    PRIMARY KEY (watchlist_id, full),
    FOREIGN KEY (watchlist_id) REFERENCES workspace_watchlists(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS workspace_theses (
    full TEXT PRIMARY KEY,
    ticker TEXT NOT NULL,
    exchange TEXT,
    is_crypto INTEGER NOT NULL CHECK (is_crypto IN (0, 1)),
    input TEXT NOT NULL,
    summary TEXT NOT NULL,
    bull_case TEXT,
    bear_case TEXT,
    catalyst TEXT,
    invalidation TEXT,
    timeframe TEXT,
    next_review_date TEXT,
    confidence INTEGER CHECK (confidence BETWEEN 0 AND 5),
    updated_at TEXT NOT NULL,
    archived_at TEXT
  );
`;

interface ProfileRow {
  default_exchange: string;
  trading_style: string | null;
  asset_focus: string;
  preferred_timeframe: string | null;
  workflow_cadence: string;
  updated_at: string;
  version: number;
}

interface WatchlistRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface InstrumentRow {
  watchlist_id: string;
  full: string;
  ticker: string;
  exchange: string | null;
  is_crypto: number;
  input: string;
  note: string | null;
  added_at: string;
}

interface ThesisRow {
  full: string;
  ticker: string;
  exchange: string | null;
  is_crypto: number;
  input: string;
  summary: string;
  bull_case: string | null;
  bear_case: string | null;
  catalyst: string | null;
  invalidation: string | null;
  timeframe: string | null;
  next_review_date: string | null;
  confidence: number | null;
  updated_at: string;
  archived_at: string | null;
}

export interface StoredWorkspace {
  data: Workspace;
  version: number;
}

export function createWorkspaceSchema(db: DatabaseSync): void {
  db.exec(WORKSPACE_DDL);
}

export function readProfileVersion(db: DatabaseSync): number | null {
  const row = db.prepare("SELECT version FROM workspace_profile WHERE id = 1").get() as
    | Pick<ProfileRow, "version">
    | undefined;
  return row ? row.version : null;
}

function invalid(what: string, cause: unknown): Error {
  const detail = cause instanceof ZodError ? cause.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : String(cause instanceof Error ? cause.message : cause);
  return new Error(`Workspace database is corrupted (${what}): ${detail}`);
}

function orUndefined<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}

export function readWorkspace(db: DatabaseSync): StoredWorkspace | null {
  const profileRow = db.prepare("SELECT * FROM workspace_profile WHERE id = 1").get() as ProfileRow | undefined;
  if (!profileRow) return null;

  let assetFocus: unknown;
  try {
    assetFocus = JSON.parse(profileRow.asset_focus);
  } catch (e) {
    throw invalid("profile.asset_focus is not valid JSON", e);
  }

  const profile: Profile = {
    defaultExchange: profileRow.default_exchange,
    tradingStyle: orUndefined(profileRow.trading_style),
    assetFocus: assetFocus as string[],
    preferredTimeframe: orUndefined(profileRow.preferred_timeframe),
    workflowCadence: profileRow.workflow_cadence as Profile["workflowCadence"],
    updatedAt: profileRow.updated_at,
  };

  const instrumentsByWatchlist = new Map<string, Instrument[]>();
  for (const row of db.prepare("SELECT * FROM workspace_watchlist_instruments ORDER BY rowid").all() as unknown as InstrumentRow[]) {
    const list = instrumentsByWatchlist.get(row.watchlist_id) ?? [];
    list.push({
      full: row.full,
      ticker: row.ticker,
      exchange: orUndefined(row.exchange),
      isCrypto: row.is_crypto === 1,
      input: row.input,
      note: orUndefined(row.note),
      addedAt: row.added_at,
    });
    instrumentsByWatchlist.set(row.watchlist_id, list);
  }

  const watchlists: Record<string, Watchlist> = Object.create(null);
  for (const row of db.prepare("SELECT * FROM workspace_watchlists ORDER BY rowid").all() as unknown as WatchlistRow[]) {
    watchlists[row.id] = {
      id: row.id,
      name: row.name,
      instruments: instrumentsByWatchlist.get(row.id) ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  const theses: Record<string, Thesis> = Object.create(null);
  for (const row of db.prepare("SELECT * FROM workspace_theses ORDER BY rowid").all() as unknown as ThesisRow[]) {
    theses[row.full] = {
      full: row.full,
      ticker: row.ticker,
      exchange: orUndefined(row.exchange),
      isCrypto: row.is_crypto === 1,
      input: row.input,
      summary: row.summary,
      bullCase: orUndefined(row.bull_case),
      bearCase: orUndefined(row.bear_case),
      catalyst: orUndefined(row.catalyst),
      invalidation: orUndefined(row.invalidation),
      timeframe: orUndefined(row.timeframe),
      nextReviewDate: orUndefined(row.next_review_date),
      confidence: orUndefined(row.confidence),
      updatedAt: row.updated_at,
      archivedAt: orUndefined(row.archived_at),
    };
  }

  let data: Workspace;
  try {
    data = WorkspaceSchema.parse({ schemaVersion: 1, profile, watchlists, theses });
  } catch (e) {
    throw invalid("stored rows fail schema validation", e);
  }
  return { data, version: profileRow.version };
}

export function writeWorkspace(db: DatabaseSync, data: Workspace, version: number): void {
  const p = data.profile;
  db.prepare(`
    INSERT OR REPLACE INTO workspace_profile
      (id, default_exchange, trading_style, asset_focus, preferred_timeframe, workflow_cadence, updated_at, version)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    p.defaultExchange,
    p.tradingStyle ?? null,
    JSON.stringify(p.assetFocus),
    p.preferredTimeframe ?? null,
    p.workflowCadence,
    p.updatedAt,
    version,
  );

  db.prepare("DELETE FROM workspace_watchlists").run();
  const insertWatchlist = db.prepare(
    "INSERT INTO workspace_watchlists (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
  );
  const insertInstrument = db.prepare(`
    INSERT INTO workspace_watchlist_instruments
      (watchlist_id, full, ticker, exchange, is_crypto, input, note, added_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const wl of Object.values(data.watchlists)) {
    insertWatchlist.run(wl.id, wl.name, wl.createdAt, wl.updatedAt);
    for (const inst of wl.instruments) {
      insertInstrument.run(
        wl.id,
        inst.full,
        inst.ticker,
        inst.exchange ?? null,
        inst.isCrypto ? 1 : 0,
        inst.input,
        inst.note ?? null,
        inst.addedAt,
      );
    }
  }

  db.prepare("DELETE FROM workspace_theses").run();
  const insertThesis = db.prepare(`
    INSERT INTO workspace_theses
      (full, ticker, exchange, is_crypto, input, summary, bull_case, bear_case, catalyst,
       invalidation, timeframe, next_review_date, confidence, updated_at, archived_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const th of Object.values(data.theses)) {
    insertThesis.run(
      th.full,
      th.ticker,
      th.exchange ?? null,
      th.isCrypto ? 1 : 0,
      th.input,
      th.summary,
      th.bullCase ?? null,
      th.bearCase ?? null,
      th.catalyst ?? null,
      th.invalidation ?? null,
      th.timeframe ?? null,
      th.nextReviewDate ?? null,
      th.confidence ?? null,
      th.updatedAt,
      th.archivedAt ?? null,
    );
  }
}
