import { backendRequest, backendUnavailable, relayJson } from "@/lib/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A render is one synchronous fal call the backend polls to completion (no runway,
// see plan-awareness-psa.md) -- it can take well past the 10s default proxy timeout.
export async function POST(request: Request) {
  const body = await request.text();
  try {
    return relayJson(
      await backendRequest("/awareness/psa/render", { method: "POST", body }, request, false, 170_000),
    );
  } catch (error) { return backendUnavailable(error); }
}
