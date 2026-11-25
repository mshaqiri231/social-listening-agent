// All database reads/writes for searches and leads live here,
// so the API routes stay short and the SQL is in one place.
import type { Row } from "@libsql/client";
import { getDb } from "./db";
import type { Analysis, Lead, LeadStatus, RawPost, SourceId } from "./types";

function rowToLead(r: Row): Lead {
  return {
    id: String(r.id),
    source: r.source as SourceId,
    externalId: String(r.external_id),
    url: String(r.url),
    authorHandle: String(r.author_handle),
    authorName: (r.author_name as string | null) ?? null,
    authorUrl: (r.author_url as string | null) ?? null,
    text: String(r.text),
    postedAt: String(r.posted_at),
    matchedKeyword: String(r.matched_keyword),
    collectedAt: String(r.collected_at),
    status: r.status as LeadStatus,
    analysis: r.analysis ? (JSON.parse(String(r.analysis)) as Analysis) : null,
    draft: String(r.draft ?? ""),
    analyzedAt: (r.analyzed_at as string | null) ?? null,
    sentAt: (r.sent_at as string | null) ?? null,
  };
}

export async function createSearch(keywords: string[], sources: SourceId[]): Promise<number> {
  const db = await getDb();
  const res = await db.execute({
    sql: "INSERT INTO searches (keywords, sources) VALUES (?, ?)",
    args: [JSON.stringify(keywords), JSON.stringify(sources)],
  });
  return Number(res.lastInsertRowid);
}

export async function finishSearch(searchId: number, found: number) {
  const db = await getDb();
  await db.execute({ sql: "UPDATE searches SET found = ? WHERE id = ?", args: [found, searchId] });
}

/**
 * Stores posts. A post we already have is left untouched (INSERT OR IGNORE),
 * so a person's review status and edited draft survive repeated searches.
 * Returns the ids of the posts in this batch.
 */
export async function saveLeads(posts: RawPost[], searchId: number): Promise<string[]> {
  const db = await getDb();
  const ids = posts.map((p) => `${p.source}:${p.externalId}`);
  await db.batch(
    posts.map((p, i) => ({
      sql: `INSERT OR IGNORE INTO leads
              (id, source, external_id, url, author_handle, author_name, author_url,
               text, posted_at, matched_keyword, search_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        ids[i], p.source, p.externalId, p.url, p.authorHandle, p.authorName,
        p.authorUrl, p.text, p.postedAt, p.matchedKeyword, searchId,
      ],
    })),
    "write",
  );
  return ids;
}

export async function listLeads(status?: LeadStatus): Promise<Lead[]> {
  const db = await getDb();
  const res = status
    ? await db.execute({
        sql: "SELECT * FROM leads WHERE status = ? ORDER BY collected_at DESC, posted_at DESC LIMIT 300",
        args: [status],
      })
    : await db.execute("SELECT * FROM leads ORDER BY collected_at DESC, posted_at DESC LIMIT 300");
  return res.rows.map(rowToLead);
}

export async function getLead(id: string): Promise<Lead | null> {
  const db = await getDb();
  const res = await db.execute({ sql: "SELECT * FROM leads WHERE id = ?", args: [id] });
  return res.rows[0] ? rowToLead(res.rows[0]) : null;
}

/**
 * Saves the AI result. A new draft always needs a fresh human review, so
 * "new" and "approved" leads move to "drafted" (or back to "new" if there is no draft).
 */
export async function saveAnalysis(id: string, analysis: Analysis) {
  const db = await getDb();
  const nextStatus = analysis.draft ? "drafted" : "new";
  await db.execute({
    sql: `UPDATE leads
             SET analysis = ?, draft = ?, analyzed_at = datetime('now'),
                 status = CASE WHEN status IN ('new', 'drafted', 'approved') THEN ? ELSE status END
           WHERE id = ?`,
    args: [JSON.stringify(analysis), analysis.draft, nextStatus, id],
  });
}

/** Human review actions: edit the draft and/or move it through the workflow. */
export async function updateLead(id: string, changes: { status?: LeadStatus; draft?: string }) {
  const db = await getDb();
  if (changes.draft !== undefined) {
    await db.execute({ sql: "UPDATE leads SET draft = ? WHERE id = ?", args: [changes.draft, id] });
  }
  if (changes.status !== undefined) {
    await db.execute({
      sql: `UPDATE leads SET status = ?,
              sent_at = CASE WHEN ? = 'sent' THEN datetime('now') ELSE sent_at END
            WHERE id = ?`,
      args: [changes.status, changes.status, id],
    });
  }
}
