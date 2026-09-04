import { backendRequest, backendUnavailable, relayJson } from "@/lib/backend";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.text();
    return relayJson(await backendRequest(`/complaints/${encodeURIComponent(id)}`, { method: "PATCH", body }, request));
  } catch (error) {
    return backendUnavailable(error);
  }
}
