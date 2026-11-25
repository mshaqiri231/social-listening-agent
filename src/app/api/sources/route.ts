import { SOURCES } from "@/lib/sources";

// GET /api/sources - which platforms exist and which are configured.
export async function GET() {
  return Response.json(
    SOURCES.map((s) => ({ id: s.id, label: s.label, note: s.note, available: s.available() })),
  );
}
