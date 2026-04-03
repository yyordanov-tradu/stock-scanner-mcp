import { z } from "zod";

export const ProfileSchema = z.object({
  defaultExchange: z.string().default("NASDAQ"),
  tradingStyle: z.string().optional(),
  assetFocus: z.array(z.string()).default([]),
  preferredTimeframe: z.string().optional(),
  workflowCadence: z.enum(["daily", "weekly"]).default("daily"),
  updatedAt: z.string(),
});

export const InstrumentSchema = z.object({
  full: z.string(),
  ticker: z.string(),
  exchange: z.string().optional(),
  isCrypto: z.boolean(),
  input: z.string(),
  note: z.string().optional(),
  addedAt: z.string(),
});

export const WatchlistSchema = z.object({
  id: z.string(),
  name: z.string(),
  instruments: z.array(InstrumentSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ThesisSchema = z.object({
  full: z.string(),
  ticker: z.string(),
  exchange: z.string().optional(),
  isCrypto: z.boolean(),
  input: z.string(),
  summary: z.string(),
  bullCase: z.string().optional(),
  bearCase: z.string().optional(),
  catalyst: z.string().optional(),
  invalidation: z.string().optional(),
  timeframe: z.string().optional(),
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
  watchlists: z.record(z.string(), WatchlistSchema).default({}),
  theses: z.record(z.string(), ThesisSchema).default({}),
});

export type Profile = z.infer<typeof ProfileSchema>;
export type Instrument = z.infer<typeof InstrumentSchema>;
export type Watchlist = z.infer<typeof WatchlistSchema>;
export type Thesis = z.infer<typeof ThesisSchema>;
export type Workspace = z.infer<typeof WorkspaceSchema>;
