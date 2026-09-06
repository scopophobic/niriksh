import type { Metadata } from "next";
import "./globals.css";
import "./ui-refresh.css";
import "./case-reconstruction.css";
import "./landing-reconstruction.css";
import { CaseStoreProvider } from "@/lib/case-store";

export const metadata: Metadata = {
  title: "Niriksh | Evidence intelligence",
  description: "Turn scattered cybercrime complaints into structured, source-backed case intelligence.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <CaseStoreProvider>{children}</CaseStoreProvider>
      </body>
    </html>
  );
}
