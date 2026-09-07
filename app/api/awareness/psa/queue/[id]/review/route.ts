import { backendRequest, backendUnavailable, relayJson } from "@/lib/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Approving here can trigger a real publish attempt, which calls out to YouTube /
// Instagram -- give it more room than the shared 10s default.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.text();
  try {
    return relayJson(
      await backendRequest(`/awareness/psa/queue/${encodeURIComponent(id)}/review`, { method: "POST", body }, request, false, 60_000),
    );
  } catch (error) { return backendUnavailable(error); }
}
