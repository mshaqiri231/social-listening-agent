// Bluesky: official AT Protocol API, app.bsky.feed.searchPosts.
// Docs: https://docs.bsky.app/docs/api/app-bsky-feed-search-posts
//
// Bluesky's search endpoint requires a logged-in session, so we sign in with an
// APP PASSWORD (created in Bluesky settings, revocable, can't change the account password).
import type { RawPost } from "../types";

const PDS = "https://bsky.social/xrpc";

interface BskyPost {
  uri: string; // at://did:plc:xxx/app.bsky.feed.post/<rkey>
  author: { did: string; handle: string; displayName?: string };
  record: { text?: string; createdAt?: string };
  indexedAt: string;
}

// Cache the access token for the life of the server process.
let session: { token: string; expires: number } | null = null;

export function blueskyConfigured(): boolean {
  return Boolean(process.env.BSKY_HANDLE && process.env.BSKY_APP_PASSWORD);
}

async function getToken(): Promise<string> {
  if (session && session.expires > Date.now()) return session.token;
  const res = await fetch(`${PDS}/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: process.env.BSKY_HANDLE,
      password: process.env.BSKY_APP_PASSWORD,
    }),
  });
  if (!res.ok) throw new Error(`Bluesky login failed (${res.status}). Check BSKY_HANDLE / BSKY_APP_PASSWORD.`);
  const data = (await res.json()) as { accessJwt: string };
  // Access tokens live ~2h; refresh well before that.
  session = { token: data.accessJwt, expires: Date.now() + 60 * 60 * 1000 };
  return session.token;
}

/** at://did/app.bsky.feed.post/rkey -> https://bsky.app/profile/handle/post/rkey */
function postUrl(p: BskyPost): string {
  const rkey = p.uri.split("/").pop();
  return `https://bsky.app/profile/${p.author.handle}/post/${rkey}`;
}

export async function searchBluesky(keywords: string[], limit: number): Promise<RawPost[]> {
  if (!blueskyConfigured()) throw new Error("Bluesky is not configured (set BSKY_HANDLE and BSKY_APP_PASSWORD).");
  const token = await getToken();
  const results: RawPost[] = [];

  for (const keyword of keywords) {
    // Bluesky search understands both plain words and #hashtags as-is.
    const url = `${PDS}/app.bsky.feed.searchPosts?q=${encodeURIComponent(keyword)}&sort=latest&limit=${Math.min(limit, 100)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!res.ok) throw new Error(`Bluesky search returned ${res.status}`);
    const data = (await res.json()) as { posts: BskyPost[] };

    for (const p of data.posts) {
      if (!p.record.text) continue;
      results.push({
        source: "bluesky",
        externalId: p.uri,
        url: postUrl(p),
        authorHandle: p.author.handle,
        authorName: p.author.displayName || null,
        authorUrl: `https://bsky.app/profile/${p.author.handle}`,
        text: p.record.text,
        postedAt: p.record.createdAt ?? p.indexedAt,
        matchedKeyword: keyword,
      });
    }
  }
  return results;
}
