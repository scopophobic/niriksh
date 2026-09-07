import { backendRequest, backendUnavailable, relayJson } from "@/lib/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const search = new URL(request.url).search;
  try { return relayJson(await backendRequest(`/awareness/psa/queue${search}`, {}, request)); }
  catch (error) { return backendUnavailable(error); }
}

export async function POST(request: Request) {
  const body = await request.text();
  try { return relayJson(await backendRequest("/awareness/psa/queue", { method: "POST", body }, request)); }
  catch (error) { return backendUnavailable(error); }
}
