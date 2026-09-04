import { backendRequest, backendUnavailable, relayJson } from "@/lib/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    return relayJson(await backendRequest("/complaints", {}, request));
  } catch (error) {
    return backendUnavailable(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    return relayJson(await backendRequest("/complaints/intake", { method: "POST", body }, request, true));
  } catch (error) {
    return backendUnavailable(error);
  }
}
