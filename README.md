# Social Listening Outreach Agent

Find people who are publicly talking about life moments where life insurance can matter (a new baby, buying a home, losing a parent, starting a business) and get a thoughtful, **human-reviewed** message suggestion for each one.

**Nothing is ever sent by the app.** A person reviews and approves every message, then copies it and sends it on the platform themselves.

## How it works

```
keywords ──► sources (official/public APIs) ──► SQLite ──► Claude: analyse + draft ──► human review queue
              Mastodon · Bluesky · Hacker News               (one call per post)        approve → copy → "I sent it"
```

1. **Input.** Enter keywords or hashtags, or click a preset for one of the four life events.
2. **Find.** Each selected source is searched in parallel and the posts are stored. Posts already collected are never duplicated, and their review state is kept.
3. **Analyse.** For each new post, Claude returns structured JSON:
   - the life event
   - whether the **author personally** is living it (as opposed to news, celebrity gossip or ads)
   - relevance (0–100) and sensitivity (low/medium/high)
   - a short reason for the reviewer
   - a suggested message, **or no message** when reaching out would be inappropriate
4. **Review.** Leads appear sorted by relevance. A reviewer edits the draft, clicks **Approve**, then **Copy & open post**, sends it by hand, and clicks **I sent it**. The server refuses to mark anything as sent unless it was approved first.

## Running it

Requires Node 20+.

```bash
npm install
cp .env.example .env.local   # then fill in ANTHROPIC_API_KEY (and optionally Bluesky)
npm run dev                  # http://localhost:3000
```

| Variable | Needed for |
|---|---|
| `ANTHROPIC_API_KEY` | Analysis and drafts (required) |
| `BSKY_HANDLE`, `BSKY_APP_PASSWORD` | Bluesky search. Use an [app password](https://bsky.app/settings/app-passwords), not the account password |
| `MASTODON_INSTANCE` | Which Mastodon server to read from (default `mastodon.social`) |
| `SENDER_NAME`, `COMPANY_NAME` | Used in drafts so every message says who is writing |
| `APP_PASSWORD` | Password-protects the app (required when deployed) |
| `DATABASE_URL`, `DATABASE_AUTH_TOKEN` | Local SQLite file by default; on Vercel use Turso (`TURSO_*` variables are read too) |

Mastodon and Hacker News work without any keys.

## Deploying (Vercel, free tier)

1. In Vercel, use **Add New → Project** and import this GitHub repository. Next.js is detected automatically.
2. In the project, go to **Storage → Create Database → Turso**. It's free and adds `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` automatically. The tables are created on first request.
3. Under **Settings → Environment Variables**, add `ANTHROPIC_API_KEY` and `APP_PASSWORD`. Optionally add the Bluesky and sender variables.
4. Redeploy. Every push to `main` deploys again automatically.

`APP_PASSWORD` puts the whole app, API included, behind a browser login prompt (any username), so a public URL can't be used by strangers.

## Code map

| Path | What it does |
|---|---|
| `src/lib/sources/*` | One file per platform, each returning the same `RawPost` shape. `index.ts` is the registry: adding a platform means one new file and one entry there. |
| `src/lib/ai.ts` | The prompt, the output schema and the Claude call |
| `src/lib/leads.ts`, `src/lib/db.ts` | All SQL (two tables: `searches`, `leads`) |
| `src/app/api/*` | `POST /api/search`, `GET /api/leads`, `PATCH /api/leads/:id`, `POST /api/leads/:id/analyze` |
| `src/components/*` | Search form, review queue, lead card |

## Platform and compliance choices

- **Official and public APIs only.**
  - Mastodon: public hashtag timelines through the REST API.
  - Bluesky: AT Protocol `searchPosts`, signed in with an app password.
  - Hacker News: the official Algolia search API.
  - No scraping.
- **Not included:**
  - Reddit: its Data API terms require a separate agreement for commercial use.
  - X: post search needs a paid API tier.
  - Both would be a single new file in `src/lib/sources/`.
- **Human in the loop, enforced on the server, not only in the UI.**
- **Honest drafts.** The prompt requires each message to say once, naturally, that the sender works at the company. It forbids pitches, prices, guarantees, urgency and fear-based wording.
- **Sensitive moments.** For grief and other high-sensitivity posts where the person isn't asking for help, the AI suggests *no* message and explains why. A reviewer can still write one by hand.
- **Prompt-injection safety.** Post text is passed to the model as untrusted data inside `<post>` tags.
- **Data minimisation.** Only the post, a link to it and the public handle are stored. No profiles or follower data.
