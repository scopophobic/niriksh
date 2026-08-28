import { AppShell } from "@/components/AppShell";
import { CaseReview } from "@/components/CaseReview";

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppShell><CaseReview id={id}/></AppShell>;
}
