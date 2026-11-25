import { createClient, type Client } from "@libsql/client";
import { mkdirSync } from "node:fs";

// One shared client per server process. In dev, Next.js hot-reloads modules,
// so we keep the client on globalThis to avoid opening a new connection per reload.
const globalForDb = globalThis as unknown as { db?: Client; dbReady?: Promise<void> };

function makeClient(): Client {
  // TURSO_* are the names Vercel's Turso integration sets; DATABASE_* are our own names.
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "file:data/app.db";
  const authToken = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN || undefined;

  if (url.startsWith("file:")) {
    // Serverless hosts (Vercel) have no lasting disk, so a local file would silently lose data.
    if (process.env.VERCEL) throw new Error("No database configured: connect a Turso database in Vercel.");
    mkdirSync("data", { recursive: true });
  }
  return createClient({ url, authToken });
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS searches (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     keywords    TEXT NOT NULL,          -- JSON array of strings
     sources     TEXT NOT NULL,          -- JSON array of source ids
     found       INTEGER NOT NULL DEFAULT 0,
     created_at  TEXT NOT NULL DEFAULT (datetime('now'))
   )`,
  `CREATE TABLE IF NOT EXISTS leads (
     id              TEXT PRIMARY KEY,   -- "<source>:<externalId>", so re-running a search never duplicates
     source          TEXT NOT NULL,
     external_id     TEXT NOT NULL,
     url             TEXT NOT NULL,
     author_handle   TEXT NOT NULL,
     author_name     TEXT,
     author_url      TEXT,
     text            TEXT NOT NULL,
     posted_at       TEXT NOT NULL,
     matched_keyword TEXT NOT NULL,
     search_id       INTEGER REFERENCES searches(id),
     collected_at    TEXT NOT NULL DEFAULT (datetime('now')),
     status          TEXT NOT NULL DEFAULT 'new',
     analysis        TEXT,               -- JSON from the AI step, null until analysed
     draft           TEXT NOT NULL DEFAULT '',
     analyzed_at     TEXT,
     sent_at         TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS leads_status ON leads(status)`,
];

/** Returns a ready-to-use client, creating tables on first use. */
export async function getDb(): Promise<Client> {
  if (!globalForDb.db) {
    globalForDb.db = makeClient();
    globalForDb.dbReady = globalForDb.db.batch(SCHEMA, "write").then(() => undefined);
  }
  await globalForDb.dbReady;
  return globalForDb.db;
}
