import { listLeads } from "@/lib/leads";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/types";

// GET /api/leads?status=drafted - the review queue.
export async function GET(request: Request) {
  const status = new URL(request.url).searchParams.get("status");
  const filter = LEAD_STATUSES.includes(status as LeadStatus) ? (status as LeadStatus) : undefined;
  return Response.json(await listLeads(filter));
}
