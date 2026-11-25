// Registry of all sources. To add a platform: write a search function that
// returns RawPost[] and add one entry here - nothing else needs to change.
import type { RawPost, SourceId } from "../types";
import { blueskyConfigured, searchBluesky } from "./bluesky";
import { searchHackerNews } from "./hackernews";
import { searchMastodon } from "./mastodon";

export interface SourceInfo {
  id: SourceId;
  label: string;
  note: string;
  available: () => boolean;
  search: (keywords: string[], limit: number) => Promise<RawPost[]>;
}

export const SOURCES: SourceInfo[] = [
  {
    id: "mastodon",
    label: "Mastodon",
    note: "Public hashtag timelines (keywords become hashtags)",
    available: () => true,
    search: searchMastodon,
  },
  {
    id: "bluesky",
    label: "Bluesky",
    note: "Full-text search; needs an app password in .env.local",
    available: blueskyConfigured,
    search: searchBluesky,
  },
  {
    id: "hackernews",
    label: "Hacker News",
    note: "Stories and comments; best for business topics",
    available: () => true,
    search: searchHackerNews,
  },
];

export interface SourceResult {
  source: SourceId;
  posts: RawPost[];
  error?: string;
}

/**
 * Runs the selected sources in parallel. One failing source doesn't fail the whole
 * search; its error is returned so the UI can show it.
 */
export async function searchAll(sourceIds: SourceId[], keywords: string[], limit = 20): Promise<SourceResult[]> {
  const selected = SOURCES.filter((s) => sourceIds.includes(s.id));
  return Promise.all(
    selected.map(async (s): Promise<SourceResult> => {
      try {
        return { source: s.id, posts: await s.search(keywords, limit) };
      } catch (e) {
        return { source: s.id, posts: [], error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );
}
