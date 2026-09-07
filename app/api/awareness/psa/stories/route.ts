import { backendRequest, backendUnavailable, relayJson } from "@/lib/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try { return relayJson(await backendRequest("/awareness/psa/stories", {}, request)); }
  catch (error) { return backendUnavailable(error); }
}
