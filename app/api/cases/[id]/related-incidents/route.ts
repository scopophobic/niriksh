import { backendRequest, backendUnavailable, relayJson } from "@/lib/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return relayJson(await backendRequest(`/complaints/${encodeURIComponent(id)}/related-incidents`, {}, request));
  } catch (error) {
    return backendUnavailable(error);
  }
}
