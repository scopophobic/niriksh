import { backendRequest, backendUnavailable, relayJson } from "@/lib/backend";

export async function POST(request: Request) {
  try {
    return relayJson(await backendRequest("/safety/check-message", {
      method: "POST",
      body: await request.text(),
      headers: { "Content-Type": "application/json" },
    }, request, true));
  } catch (error) {
    return backendUnavailable(error);
  }
}
