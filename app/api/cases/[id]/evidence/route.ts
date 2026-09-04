import { backendRequest, backendUnavailable, relayJson } from "@/lib/backend";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.formData();
    const uploadToken = request.headers.get("X-Complaint-Token") || "";
    return relayJson(await backendRequest(
      `/complaints/${encodeURIComponent(id)}/intake-evidence`,
      { method: "POST", body, headers: { "X-Complaint-Token": uploadToken } },
      request,
      true,
    ));
  } catch (error) {
    return backendUnavailable(error);
  }
}

