import { AppShell } from "@/components/AppShell";
import { PatternDetail } from "@/components/PatternDetail";

export default async function PatternPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppShell><PatternDetail id={id}/></AppShell>;
}
