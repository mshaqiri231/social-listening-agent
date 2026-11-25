import { z } from "zod";
import { createSearch, finishSearch, saveLeads } from "@/lib/leads";
import { searchAll } from "@/lib/sources";

const Body = z.object({
  keywords: z.array(z.string().trim().min(1).max(60)).min(1).max(10),
  sources: z.array(z.enum(["bluesky", "mastodon", "hackernews"])).min(1),
  limit: z.number().int().min(1).max(50).optional(),
});

// POST /api/search - fetch public posts for the keywords and store them as leads.
// Analysis happens afterwards, one lead at a time (see /api/leads/[id]/analyze),
// so this request stays fast and the UI can show progress.
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Enter 1-10 keywords and pick at least one source." }, { status: 400 });
  }
  const { keywords, sources, limit = 20 } = parsed.data;

  const searchId = await createSearch(keywords, sources);
  const results = await searchAll(sources, keywords, limit);

  // The same post can match two keywords - keep the first.
  const seen = new Set<string>();
  const posts = results
    .flatMap((r) => r.posts)
    .filter((p) => {
      const key = `${p.source}:${p.externalId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const ids = posts.length ? await saveLeads(posts, searchId) : [];
  await finishSearch(searchId, ids.length);

  return Response.json({
    searchId,
    leadIds: ids,
    perSource: results.map((r) => ({ source: r.source, count: r.posts.length, error: r.error })),
  });
}
