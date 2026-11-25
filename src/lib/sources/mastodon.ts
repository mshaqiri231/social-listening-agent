// Mastodon: reads PUBLIC hashtag timelines through the official REST API.
// No login is needed. Docs: https://docs.joinmastodon.org/methods/timelines/#tag
//
// Mastodon's full-text search only covers posts whose authors opted in, so we use
// hashtags: "new baby" -> #newbaby. That is also how people tag these life events there.
import type { RawPost } from "../types";

interface MastodonStatus {
  id: string;
  url: string | null;
  uri: string;
  created_at: string;
  content: string; // HTML
  visibility: string;
  account: { acct: string; display_name: string; url: string; bot: boolean };
}

/** "New baby!" -> "newbaby"; "#FirstHome" -> "firsthome" */
export function toHashtag(keyword: string): string {
  return keyword.toLowerCase().replace(/^#/, "").replace(/[^\p{L}\p{N}_]/gu, "");
}

/** Mastodon returns HTML. Convert to plain text for storage and for the AI. */
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export async function searchMastodon(keywords: string[], limit: number): Promise<RawPost[]> {
  const instance = (process.env.MASTODON_INSTANCE || "https://mastodon.social").replace(/\/$/, "");
  const results: RawPost[] = [];

  for (const keyword of keywords) {
    const tag = toHashtag(keyword);
    if (!tag) continue;
    const res = await fetch(
      `${instance}/api/v1/timelines/tag/${encodeURIComponent(tag)}?limit=${Math.min(limit, 40)}`,
      { headers: { Accept: "application/json" }, cache: "no-store" },
    );
    if (!res.ok) throw new Error(`Mastodon returned ${res.status} for #${tag}`);
    const statuses = (await res.json()) as MastodonStatus[];

    for (const s of statuses) {
      // Only public posts from humans.
      if (s.visibility !== "public" || s.account.bot) continue;
      results.push({
        source: "mastodon",
        externalId: s.uri, // globally unique, even across servers
        url: s.url ?? s.uri,
        authorHandle: s.account.acct,
        authorName: s.account.display_name || null,
        authorUrl: s.account.url,
        text: htmlToText(s.content),
        postedAt: s.created_at,
        matchedKeyword: keyword,
      });
    }
  }
  return results;
}
