import type { Metadata } from "next";
import "./globals.css";
import "./ui-refresh.css";
import "./case-reconstruction.css";
import "./landing-reconstruction.css";
import "./prevention.css";
import "./workspace-redesign.css";
import "./case-network.css";
import "./awareness-workflow.css";
import "./landing-prevention.css";
import { CaseStoreProvider } from "@/lib/case-store";

export const metadata: Metadata = {
  title: "Niriksh | Prevention intelligence",
  description: "Turn cybercrime reports into structured intelligence that helps surface recurring patterns earlier.",
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
