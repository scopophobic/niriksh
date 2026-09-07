import { backendRequest, backendUnavailable, relayJson } from "@/lib/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.text();
  try {
    return relayJson(
      await backendRequest("/awareness/psa/script", { method: "POST", body }, request, false, 30_000),
    );
  } catch (error) { return backendUnavailable(error); }
}
