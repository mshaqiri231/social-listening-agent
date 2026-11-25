"use client";

import { useState } from "react";
import type { SourceId } from "@/lib/types";

export interface SourceOption {
  id: SourceId;
  label: string;
  note: string;
  available: boolean;
}

// One-click starting points for the four life events in the brief.
const PRESETS: { label: string; keywords: string[] }[] = [
  { label: "New baby", keywords: ["newborn", "new baby", "just had a baby"] },
  { label: "Buying a house", keywords: ["first home", "new homeowner", "closed on our house"] },
  { label: "Losing a parent", keywords: ["lost my dad", "lost my mom", "grief"] },
  { label: "Starting a business", keywords: ["started my own business", "small business owner"] },
];

interface Props {
  sources: SourceOption[];
  busy: boolean;
  onSearch: (keywords: string[], sources: SourceId[]) => void;
}

export function SearchForm({ sources, busy, onSearch }: Props) {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [selected, setSelected] = useState<SourceId[]>(["mastodon"]);

  function addKeyword(raw: string) {
    // Allow pasting "a, b, c"
    const parts = raw.split(",").map((k) => k.trim()).filter(Boolean);
    setKeywords((prev) => [...new Set([...prev, ...parts])].slice(0, 10));
    setInput("");
  }

  function toggleSource(id: SourceId) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  // Include whatever is still typed in the box, so "type + click Search" works.
  const pending = input.trim() ? [...keywords, input.trim()] : keywords;
  const canSearch = pending.length > 0 && selected.length > 0 && !busy;

  return (
    <form
      className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSearch) return;
        setKeywords([...new Set(pending)]);
        setInput("");
        onSearch([...new Set(pending)], selected);
      }}
    >
      <label className="text-xs font-semibold uppercase tracking-wider text-red-600">Keywords or hashtags</label>
      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-neutral-300 px-2 py-2 focus-within:border-neutral-900">
        {keywords.map((k) => (
          <span key={k} className="flex items-center gap-1 rounded-full bg-neutral-900 px-3 py-1 text-sm text-white">
            {k}
            <button
              type="button"
              aria-label={`Remove ${k}`}
              className="ml-1 text-neutral-400 hover:text-white"
              onClick={() => setKeywords(keywords.filter((x) => x !== k))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) {
              e.preventDefault();
              addKeyword(input);
            } else if (e.key === "Backspace" && !input && keywords.length) {
              setKeywords(keywords.slice(0, -1));
            }
          }}
          placeholder={keywords.length ? "Add another…" : "e.g. new baby, #firsthome — press Enter to add"}
          className="min-w-48 flex-1 px-1 py-1 text-sm outline-none"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="py-1 text-xs text-neutral-500">Quick start:</span>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setKeywords(p.keywords)}
            className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-700 hover:border-neutral-900"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <fieldset className="flex flex-wrap gap-4">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-600">Sources</legend>
          {sources.map((s) => (
            <label
              key={s.id}
              title={s.note}
              className={`flex items-center gap-2 text-sm ${s.available ? "" : "cursor-not-allowed text-neutral-400"}`}
            >
              <input
                type="checkbox"
                disabled={!s.available}
                checked={s.available && selected.includes(s.id)}
                onChange={() => toggleSource(s.id)}
                className="accent-red-600"
              />
              {s.label}
              {!s.available && <span className="text-xs">(not configured)</span>}
            </label>
          ))}
        </fieldset>

        <button
          type="submit"
          disabled={!canSearch}
          className="rounded-lg bg-red-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          {busy ? "Searching…" : "Find people"}
        </button>
      </div>
    </form>
  );
}
