import { Suspense } from "react";
import { connection } from "next/server";
import { Dashboard } from "@/components/Dashboard";
import { listLeads } from "@/lib/leads";
import { SOURCES } from "@/lib/sources";

export default function Home() {
  // The shell renders instantly; the data part streams in when the database answers.
  return (
    <Suspense fallback={<p className="p-10 text-center text-sm text-neutral-500">Loading…</p>}>
      <DashboardWithData />
    </Suspense>
  );
}

// Server component: loads the initial data directly from the database,
// then hands it to the interactive Dashboard (a client component).
async function DashboardWithData() {
  await connection(); // always render on request - the data changes all the time
  const leads = await listLeads();
  const sources = SOURCES.map((s) => ({ id: s.id, label: s.label, note: s.note, available: s.available() }));
  return <Dashboard initialLeads={leads} sources={sources} />;
}
