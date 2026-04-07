import { z } from "zod";

export const RESERVED_KEYS = new Set(["__proto__", "constructor", "prototype", "toString", "valueOf", "hasOwnProperty"]);

export const ProfileSchema = z.object({
  defaultExchange: z.string().max(20).default("NASDAQ"),
  tradingStyle: z.string().max(100).optional(),
  assetFocus: z.array(z.string().max(50)).max(20).default([]),
  preferredTimeframe: z.string().max(50).optional(),
  workflowCadence: z.enum(["daily", "weekly"]).default("daily"),
  updatedAt: z.string(),
});

export const InstrumentSchema = z.object({
  full: z.string().max(80),
  ticker: z.string().max(50),
  exchange: z.string().optional(),
  isCrypto: z.boolean(),
  input: z.string().max(50),
  note: z.string().max(500).optional(),
  addedAt: z.string(),
});

export const WatchlistSchema = z.object({
  id: z.string().max(100),
  name: z.string().max(100),
  instruments: z.array(InstrumentSchema).max(200).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ThesisSchema = z.object({
  full: z.string().max(80),
  ticker: z.string().max(50),
  exchange: z.string().optional(),
  isCrypto: z.boolean(),
  input: z.string().max(50),
  summary: z.string().max(5000),
  bullCase: z.string().max(2000).optional(),
  bearCase: z.string().max(2000).optional(),
  catalyst: z.string().max(2000).optional(),
  invalidation: z.string().max(2000).optional(),
  timeframe: z.string().max(100).optional(),
  nextReviewDate: z.string().optional(),
  confidence: z.number().min(0).max(5).optional(),
  updatedAt: z.string(),
  archivedAt: z.string().optional(),
});

export const WorkspaceSchema = z.object({
  schemaVersion: z.number().default(1),
  profile: ProfileSchema.default({
    defaultExchange: "NASDAQ",
    assetFocus: [],
    workflowCadence: "daily",
    updatedAt: new Date(0).toISOString(),
  }),
  watchlists: z.record(z.string(), WatchlistSchema)
    .refine(
      (rec) => Object.keys(rec).every((k) => !RESERVED_KEYS.has(k)),
      { message: "Workspace contains a reserved key in watchlists" }
    )
    .default({}),
  theses: z.record(z.string(), ThesisSchema)
    .refine(
      (rec) => Object.keys(rec).every((k) => !RESERVED_KEYS.has(k)),
      { message: "Workspace contains a reserved key in theses" }
    )
    .default({}),
});

export type Profile = z.infer<typeof ProfileSchema>;
export type Instrument = z.infer<typeof InstrumentSchema>;
export type Watchlist = z.infer<typeof WatchlistSchema>;
export type Thesis = z.infer<typeof ThesisSchema>;
export type Workspace = z.infer<typeof WorkspaceSchema>;
