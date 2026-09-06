import { backendRequest, backendUnavailable, relayJson } from "@/lib/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    return relayJson(
      await backendRequest(`/public/tracking/${encodeURIComponent(token)}`, {}, request, true),
    );
  } catch (error) {
    return backendUnavailable(error);
  }
}
