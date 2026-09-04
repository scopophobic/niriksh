import "server-only";

const BASE_URL = (process.env.BACKEND_API_URL || "http://127.0.0.1:8000/api/v1").replace(/\/$/, "");

class BackendAuthenticationError extends Error {}

function cookieValue(header: string | null, name: string) {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

export async function backendRequest(path: string, init: RequestInit = {}, incoming?: Request, publicEndpoint = false) {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  const authorization = incoming?.headers.get("Authorization");
  const sessionToken = cookieValue(incoming?.headers.get("cookie") || null, "niriksh_session");
  const demoProxyAllowed = process.env.NODE_ENV !== "production" || process.env.BACKEND_ALLOW_DEMO_PROXY === "true";
  if (authorization) headers.set("Authorization", authorization);
  else if (sessionToken) headers.set("Authorization", `Bearer ${sessionToken}`);
  else if (demoProxyAllowed && !publicEndpoint) headers.set("X-Internal-API-Key", process.env.BACKEND_INTERNAL_API_KEY || "local-development-key");
  else if (publicEndpoint) { /* public intake is authorised by the backend route itself */ }
  else throw new BackendAuthenticationError("Officer authentication is required");
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(`${BASE_URL}${path}`, { ...init, headers, cache: "no-store", signal: AbortSignal.timeout(10_000) });
}

export async function relayJson(response: Response) {
  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("Content-Type") || "application/json" },
  });
}

export function backendUnavailable(error: unknown) {
  if (error instanceof BackendAuthenticationError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  console.error("Backend request failed", error);
  return Response.json({ error: "The Niriksh backend is temporarily unavailable." }, { status: 503 });
}
