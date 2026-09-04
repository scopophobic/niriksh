import { backendRequest, backendUnavailable, relayJson } from "@/lib/backend";

export async function GET(request: Request) {
  try {
    return relayJson(await backendRequest("/auth/me", {}, request));
  } catch (error) {
    return backendUnavailable(error);
  }
}

