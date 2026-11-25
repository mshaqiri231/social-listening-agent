"use client";

import { useMemo, useState } from "react";
import type { Lead, LeadStatus, SourceId } from "@/lib/types";
import { LeadCard } from "./LeadCard";
import { SearchForm, type SourceOption } from "./SearchForm";

type Tab = "all" | LeadStatus;
const TABS: { id: Tab; label: string }[] = [
  { id: "drafted", label: "Needs review" },
  { id: "approved", label: "Approved" },
  { id: "sent", label: "Sent" },
  { id: "new", label: "No draft" },
  { id: "skipped", label: "Skipped" },
  { id: "all", label: "All" },
];

// How many posts are analysed at the same time (keeps us well under API rate limits).
const CONCURRENCY = 4;

interface SearchSummary {
  perSource: { source: SourceId; count: number; error?: string }[];
  total: number;
}

interface Props {
  initialLeads: Lead[];
  sources: SourceOption[];
}

export function Dashboard({ initialLeads, sources }: Props) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [tab, setTab] = useState<Tab>("drafted");
  const [hideIrrelevant, setHideIrrelevant] = useState(true);
  const [searching, setSearching] = useState(false);
  const [summary, setSummary] = useState<SearchSummary | null>(null);
  const [analyzing, setAnalyzing] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadLeads(): Promise<Lead[]> {
    const list: Lead[] = await fetch("/api/leads").then((r) => r.json());
    setLeads(list);
    return list;
  }

  /** Replace one lead in the list with the fresh copy the server returned. */
  const replaceLead = (updated: Lead) => setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));

  async function analyze(id: string) {
    setAnalyzing((s) => new Set(s).add(id));
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(id)}/analyze`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Analysis failed");
      replaceLead(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalyzing((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  }

  /** Analyse many leads, a few at a time, updating a progress bar. */
  async function analyzeMany(ids: string[]) {
    let done = 0;
    setProgress({ done, total: ids.length });
    const queue = [...ids];
    const worker = async () => {
      for (let id = queue.shift(); id; id = queue.shift()) {
        await analyze(id);
        setProgress({ done: ++done, total: ids.length });
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setProgress(null);
  }

  async function search(keywords: string[], sourceIds: SourceId[]) {
    setSearching(true);
    setError(null);
    setSummary(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords, sources: sourceIds }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Search failed");
      setSummary({ perSource: body.perSource, total: body.leadIds.length });
      const all = await loadLeads();
      setTab("drafted");
      // Only analyse posts we haven't analysed before.
      const toAnalyze = all.filter((l) => body.leadIds.includes(l.id) && !l.analysis).map((l) => l.id);
      if (toAnalyze.length) await analyzeMany(toAnalyze);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSearching(false);
    }
  }

  async function update(id: string, changes: { status?: LeadStatus; draft?: string }) {
    const res = await fetch(`/api/leads/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    const body = await res.json();
    if (!res.ok) return setError(body.error ?? "Update failed");
    replaceLead(body);
  }

  // A lead is "irrelevant" once the AI has looked at it and found no personal life event.
  const isIrrelevant = (l: Lead) => !!l.analysis && (!l.analysis.isPersonal || l.analysis.relevance < 40);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: leads.length };
    for (const l of leads) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [leads]);

  const visible = leads
    .filter((l) => tab === "all" || l.status === tab)
    .filter((l) => !hideIrrelevant || !isIrrelevant(l) || l.status === "sent" || l.status === "approved")
    .sort((a, b) => (b.analysis?.relevance ?? -1) - (a.analysis?.relevance ?? -1));
  const hiddenCount = leads.filter((l) => (tab === "all" || l.status === tab)).length - visible.length;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-600">Social listening</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Find people at life moments</h1>
        <p className="mt-2 text-neutral-600">
          Search public posts, review AI-suggested messages, and send the ones you approve yourself. Nothing is
          posted automatically.
        </p>
      </header>

      <SearchForm sources={sources} busy={searching} onSearch={search} />

      {/* Status line: per-source results, AI progress, errors */}
      <div className="mt-4 space-y-2 text-sm">
        {summary && (
          <p className="text-neutral-600">
            Found {summary.total} posts —{" "}
            {summary.perSource.map((s, i) => (
              <span key={s.source}>
                {i > 0 && ", "}
                {s.source}: {s.error ? <span className="text-red-600">{s.error}</span> : s.count}
              </span>
            ))}
          </p>
        )}
        {progress && (
          <div>
            <p className="text-neutral-600">
              Reading posts and drafting messages… {progress.done}/{progress.total}
            </p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-200">
              <div
                className="h-full bg-red-600 transition-all"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
        {error && (
          <p className="flex justify-between rounded-lg bg-red-50 px-3 py-2 text-red-700">
            {error}
            <button onClick={() => setError(null)} aria-label="Dismiss">×</button>
          </p>
        )}
      </div>

      {/* Review queue */}
      <nav className="mt-6 flex flex-wrap items-center gap-1 border-b border-neutral-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              tab === t.id ? "border-red-600 font-semibold text-neutral-900" : "border-transparent text-neutral-500"
            }`}
          >
            {t.label} <span className="text-neutral-400">{counts[t.id] ?? 0}</span>
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 py-2 text-xs text-neutral-600">
          <input
            type="checkbox"
            checked={hideIrrelevant}
            onChange={(e) => setHideIrrelevant(e.target.checked)}
            className="accent-red-600"
          />
          Hide posts that aren&apos;t personal life events
        </label>
      </nav>

      <section className="mt-4 space-y-4">
        {visible.map((l) => (
          <LeadCard
            key={l.id}
            lead={l}
            analyzing={analyzing.has(l.id)}
            onAnalyze={() => analyze(l.id)}
            onUpdate={(changes) => update(l.id, changes)}
          />
        ))}
        {visible.length === 0 && (
          <p className="py-12 text-center text-sm text-neutral-500">
            {leads.length === 0 ? "Search for a topic to get started." : "Nothing here."}
          </p>
        )}
        {hiddenCount > 0 && (
          <p className="text-center text-xs text-neutral-400">
            {hiddenCount} post{hiddenCount === 1 ? "" : "s"} hidden as not relevant.{" "}
            <button className="underline" onClick={() => setHideIrrelevant(false)}>
              Show
            </button>
          </p>
        )}
      </section>
    </div>
  );
}
