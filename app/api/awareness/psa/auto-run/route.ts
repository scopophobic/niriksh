import { backendRequest, backendUnavailable, relayJson } from "@/lib/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Same reasoning as /render: this writes a script then renders a real clip.
export async function POST(request: Request) {
  try {
    return relayJson(await backendRequest("/awareness/psa/auto-run", { method: "POST", body: "{}" }, request, false, 170_000));
  } catch (error) { return backendUnavailable(error); }
}
