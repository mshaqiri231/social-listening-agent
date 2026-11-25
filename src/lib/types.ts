// Shared types used by the sources, the database layer and the UI.

export type SourceId = "bluesky" | "mastodon" | "hackernews";

/** A public post as returned by any source, normalised to one shape. */
export interface RawPost {
  source: SourceId;
  externalId: string; // the platform's own id for the post
  url: string; // link to the original post (where the human replies)
  authorHandle: string;
  authorName: string | null;
  authorUrl: string | null;
  text: string;
  postedAt: string; // ISO date
  matchedKeyword: string; // which of the user's keywords found it
}

/** Review workflow. Nothing is ever sent by the app - "sent" is set by a human. */
export const LEAD_STATUSES = ["new", "drafted", "approved", "sent", "skipped"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LIFE_EVENTS = [
  "new_baby",
  "home_purchase",
  "loss_of_parent",
  "new_business",
  "marriage",
  "other",
  "none",
] as const;
export type LifeEvent = (typeof LIFE_EVENTS)[number];

export type Sensitivity = "low" | "medium" | "high";

/** What the AI concluded about a post. */
export interface Analysis {
  lifeEvent: LifeEvent;
  isPersonal: boolean; // is the author living this, or is it news/ads/advice?
  relevance: number; // 0-100
  sensitivity: Sensitivity;
  summary: string;
  reasoning: string;
  draft: string; // empty when the AI recommends not reaching out
}

/** A collected post plus its review state, as stored in the database. */
export interface Lead extends RawPost {
  id: string;
  status: LeadStatus;
  collectedAt: string;
  analysis: Analysis | null;
  draft: string;
  analyzedAt: string | null;
  sentAt: string | null;
}
