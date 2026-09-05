import { CitizenDashboard } from "@/components/CitizenDashboard";
import { CitizenShell } from "@/components/CitizenShell";
import { PublicTrackingView } from "@/components/PublicTrackingView";

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const params = await searchParams;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  return <CitizenShell>{token ? <PublicTrackingView token={token}/> : <CitizenDashboard/>}</CitizenShell>;
}
