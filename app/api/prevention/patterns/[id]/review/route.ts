import { backendRequest, backendUnavailable, relayJson } from "@/lib/backend";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const { id } = await context.params; return relayJson(await backendRequest(`/prevention/patterns/${encodeURIComponent(id)}/review`, { method: "POST", body: await request.text() }, request)); }
  catch (error) { return backendUnavailable(error); }
}
