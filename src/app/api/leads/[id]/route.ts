import { z } from "zod";
import { getLead, updateLead } from "@/lib/leads";
import { LEAD_STATUSES } from "@/lib/types";

const Body = z.object({
  status: z.enum(LEAD_STATUSES).optional(),
  draft: z.string().max(5000).optional(),
});

// PATCH /api/leads/:id - the human review actions (edit draft, approve, mark sent, skip).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid update" }, { status: 400 });
  const changes = parsed.data;

  // Guard the rule "a person reviews every message first":
  // a lead can only be marked sent after it was approved.
  if (changes.status === "sent" && lead.status !== "approved") {
    return Response.json({ error: "Approve the message before marking it as sent." }, { status: 409 });
  }
  if (changes.status === "approved" && !(changes.draft ?? lead.draft).trim()) {
    return Response.json({ error: "There is no message to approve." }, { status: 409 });
  }

  await updateLead(id, changes);
  return Response.json(await getLead(id));
}
