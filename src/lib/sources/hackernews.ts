// Hacker News: public search API run by Algolia (the official HN search).
// No login needed. Docs: https://hn.algolia.com/api
// Useful mainly for "starting a business" / founder topics.
import type { RawPost } from "../types";

interface HnHit {
  objectID: string;
  author: string;
  created_at: string;
  title: string | null; // stories have a title
  story_text: string | null; // "Ask HN" style stories have text
  comment_text: string | null; // comments have text
  story_id: number | null;
}

function htmlToText(html: string): string {
  return html
    .replace(/<p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&#x2F;/g, "/")
    .replace(/&amp;/g, "&")
    .trim();
}

export async function searchHackerNews(keywords: string[], limit: number): Promise<RawPost[]> {
  const results: RawPost[] = [];

  for (const keyword of keywords) {
    const query = keyword.replace(/^#/, "");
    // Newest first; stories and comments, which is where people talk about themselves.
    const url =
      `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(query)}` +
      `&tags=(story,comment)&hitsPerPage=${Math.min(limit, 50)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Hacker News returned ${res.status}`);
    const data = (await res.json()) as { hits: HnHit[] };

    for (const hit of data.hits) {
      const body = htmlToText(hit.comment_text ?? hit.story_text ?? "");
      const text = [hit.title, body].filter(Boolean).join("\n\n");
      if (!text) continue;
      results.push({
        source: "hackernews",
        externalId: hit.objectID,
        url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
        authorHandle: hit.author,
        authorName: null,
        authorUrl: `https://news.ycombinator.com/user?id=${hit.author}`,
        text,
        postedAt: hit.created_at,
        matchedKeyword: keyword,
      });
    }
  }
  return results;
}
