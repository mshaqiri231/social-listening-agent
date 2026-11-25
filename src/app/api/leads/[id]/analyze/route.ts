import { AnalysisError, analyzePost } from "@/lib/ai";
import { getLead, saveAnalysis } from "@/lib/leads";

// One Claude call can take a while; give it room on Vercel (default limits are lower).
export const maxDuration = 60;

// POST /api/leads/:id/analyze - run the AI on one lead (also used for "regenerate").
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });
  if (lead.status === "sent") {
    return Response.json({ error: "This message was already sent." }, { status: 409 });
  }

  try {
    const analysis = await analyzePost(lead);
    await saveAnalysis(id, analysis);
    return Response.json(await getLead(id));
  } catch (e) {
    if (e instanceof AnalysisError) return Response.json({ error: e.message }, { status: 502 });
    throw e;
  }
}
