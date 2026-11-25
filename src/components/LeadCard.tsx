"use client";

import { useState } from "react";
import type { Lead, LeadStatus, SourceId } from "@/lib/types";

const SOURCE_STYLE: Record<SourceId, { label: string; className: string; limit: number }> = {
  bluesky: { label: "Bluesky", className: "bg-sky-100 text-sky-800", limit: 300 },
  mastodon: { label: "Mastodon", className: "bg-violet-100 text-violet-800", limit: 500 },
  hackernews: { label: "Hacker News", className: "bg-orange-100 text-orange-800", limit: 5000 },
};

const EVENT_LABEL: Record<string, string> = {
  new_baby: "New baby",
  home_purchase: "Buying a home",
  loss_of_parent: "Loss of a parent",
  new_business: "New business",
  marriage: "Marriage",
  other: "Other life event",
  none: "No life event",
};

const SENSITIVITY_STYLE = {
  low: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-800",
};

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 60 / 24)}d ago`;
}

interface Props {
  lead: Lead;
  analyzing: boolean;
  onAnalyze: () => void;
  onUpdate: (changes: { status?: LeadStatus; draft?: string }) => Promise<void>;
}

export function LeadCard({ lead, analyzing, onAnalyze, onUpdate }: Props) {
  const [draft, setDraft] = useState(lead.draft);
  const [syncedDraft, setSyncedDraft] = useState(lead.draft);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // When the server sends a new draft (e.g. after "Regenerate"), show it.
  if (lead.draft !== syncedDraft) {
    setSyncedDraft(lead.draft);
    setDraft(lead.draft);
  }

  const a = lead.analysis;
  const src = SOURCE_STYLE[lead.source];
  const dirty = draft !== lead.draft;
  const overLimit = draft.length > src.limit;
  const locked = lead.status === "sent";

  async function copyAndOpen() {
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    window.open(lead.url, "_blank", "noopener,noreferrer");
  }

  return (
    <article
      className={`rounded-xl border bg-white p-5 shadow-sm ${
        lead.status === "skipped" ? "border-neutral-200 opacity-60" : "border-neutral-200"
      }`}
    >
      {/* Header: who, where, when */}
      <header className="flex flex-wrap items-center gap-2 text-sm">
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${src.className}`}>{src.label}</span>
        <a href={lead.authorUrl ?? lead.url} target="_blank" rel="noreferrer" className="font-semibold hover:underline">
          {lead.authorName ?? lead.authorHandle}
        </a>
        <span className="text-neutral-500">@{lead.authorHandle}</span>
        <span className="text-neutral-400">· {timeAgo(lead.postedAt)}</span>
        <span className="text-neutral-400">· matched “{lead.matchedKeyword}”</span>
        <a href={lead.url} target="_blank" rel="noreferrer" className="ml-auto text-xs text-red-600 hover:underline">
          View original ↗
        </a>
      </header>

      {/* What they said */}
      <p
        className={`mt-3 whitespace-pre-line text-[15px] leading-relaxed text-neutral-800 ${expanded ? "" : "line-clamp-4"}`}
      >
        {lead.text}
      </p>
      {lead.text.length > 280 && (
        <button onClick={() => setExpanded(!expanded)} className="mt-1 text-xs text-neutral-500 hover:underline">
          {expanded ? "Show less" : "Show more"}
        </button>
      )}

      {/* AI assessment */}
      {a ? (
        <div className="mt-4 rounded-lg bg-neutral-50 p-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <span className="rounded bg-neutral-900 px-2 py-0.5 text-xs text-white">{EVENT_LABEL[a.lifeEvent]}</span>
            <span className="rounded bg-white px-2 py-0.5 text-xs ring-1 ring-neutral-200">
              Relevance {a.relevance}
            </span>
            <span className={`rounded px-2 py-0.5 text-xs ${SENSITIVITY_STYLE[a.sensitivity]}`}>
              {a.sensitivity} sensitivity
            </span>
            {!a.isPersonal && (
              <span className="rounded bg-white px-2 py-0.5 text-xs text-neutral-600 ring-1 ring-neutral-200">
                Not personal
              </span>
            )}
          </div>
          <p className="mt-2 text-neutral-600">
            <span className="font-medium text-neutral-800">Why: </span>
            {a.reasoning}
          </p>
        </div>
      ) : (
        <div className="mt-4 text-sm text-neutral-500">
          {analyzing ? "Analysing…" : "Not analysed yet."}
        </div>
      )}

      {/* Suggested message (editable) */}
      {a && (a.draft || lead.draft || lead.status !== "new") ? (
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wider text-red-600">Suggested message</span>
            <span className={overLimit ? "font-semibold text-red-600" : "text-neutral-400"}>
              {draft.length} / {src.limit}
            </span>
          </div>
          <textarea
            value={draft}
            disabled={locked}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => dirty && onUpdate({ draft })}
            rows={Math.min(8, Math.max(3, Math.ceil(draft.length / 80)))}
            placeholder="Write your own message…"
            className="w-full rounded-lg border border-neutral-300 p-3 text-sm leading-relaxed outline-none focus:border-neutral-900 disabled:bg-neutral-50"
          />
        </div>
      ) : a ? (
        <p className="mt-4 text-sm text-neutral-500">
          No message suggested.{" "}
          <button className="text-red-600 hover:underline" onClick={() => onUpdate({ status: "drafted" })}>
            Write one anyway
          </button>
        </p>
      ) : null}

      {/* Actions. Nothing is posted by the app: a human copies the message and sends it on the platform. */}
      <footer className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <StatusBadge status={lead.status} sentAt={lead.sentAt} />
        <div className="ml-auto flex flex-wrap gap-2">
          {!locked && (
            <button
              onClick={onAnalyze}
              disabled={analyzing}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 hover:border-neutral-900 disabled:opacity-50"
            >
              {analyzing ? "Working…" : a ? "Regenerate" : "Analyse"}
            </button>
          )}
          {lead.status !== "skipped" && !locked && (
            <button
              onClick={() => onUpdate({ status: "skipped" })}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 hover:border-neutral-900"
            >
              Skip
            </button>
          )}
          {lead.status === "skipped" && (
            <button
              onClick={() => onUpdate({ status: lead.draft ? "drafted" : "new" })}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 hover:border-neutral-900"
            >
              Restore
            </button>
          )}
          {lead.status === "drafted" && (
            <button
              onClick={() => onUpdate({ status: "approved", draft })}
              disabled={!draft.trim() || overLimit}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 font-medium text-white hover:bg-neutral-700 disabled:bg-neutral-300"
            >
              Approve
            </button>
          )}
          {lead.status === "approved" && (
            <>
              <button
                onClick={() => onUpdate({ status: "drafted" })}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 hover:border-neutral-900"
              >
                Unapprove
              </button>
              <button
                onClick={copyAndOpen}
                className="rounded-lg bg-neutral-900 px-3 py-1.5 font-medium text-white hover:bg-neutral-700"
              >
                {copied ? "Copied ✓" : "Copy & open post"}
              </button>
              <button
                onClick={() => onUpdate({ status: "sent" })}
                className="rounded-lg bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700"
              >
                I sent it
              </button>
            </>
          )}
        </div>
      </footer>
    </article>
  );
}

function StatusBadge({ status, sentAt }: { status: LeadStatus; sentAt: string | null }) {
  const text: Record<LeadStatus, string> = {
    new: "New",
    drafted: "Needs review",
    approved: "Approved – ready to send",
    sent: `Sent manually${sentAt ? ` · ${new Date(sentAt + "Z").toLocaleString()}` : ""}`,
    skipped: "Skipped",
  };
  return <span className="text-xs font-medium text-neutral-500">{text[status]}</span>;
}
