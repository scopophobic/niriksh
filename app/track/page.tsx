import { CitizenDashboard } from "@/components/CitizenDashboard";
import { CitizenShell } from "@/components/CitizenShell";
import { PublicTrackingView } from "@/components/PublicTrackingView";

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ token?: string | string[]; ref?: string | string[] }> }) {
  const params = await searchParams;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const reference = Array.isArray(params.ref) ? params.ref[0] : params.ref;
  return <CitizenShell>{token ? <PublicTrackingView token={token}/> : <CitizenDashboard initialReference={reference}/>}</CitizenShell>;
}
