import { AppShell } from "@/components/AppShell";
import { AwarenessStudio } from "@/components/AwarenessStudio";

export default async function AwarenessPage({ searchParams }: PageProps<"/awareness">) {
  const query = await searchParams;
  const pattern = typeof query.pattern === "string" ? query.pattern : undefined;
  return <AppShell><AwarenessStudio initialPatternId={pattern}/></AppShell>;
}
