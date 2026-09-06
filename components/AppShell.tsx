"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Cloud, CloudOff, FilePlus2, LayoutDashboard, LoaderCircle, LogOut, Menu, RefreshCw, Route, Settings2, ShieldCheck, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Logo } from "./Logo";
import { POVSwitch } from "./POVSwitch";
import { useCaseStore } from "@/lib/case-store";

const nav = [
  { href: "/prevention", label: "Prevention intelligence", icon: Sparkles },
  { href: "/dashboard", label: "Case dashboard", icon: LayoutDashboard },
  { href: "/routing", label: "Routing desk", icon: Route },
  { href: "/report", label: "Register complaint", icon: FilePlus2 },
  { href: "/admin", label: "Administration", icon: Settings2 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { syncState, retrySync } = useCaseStore();
  const logout = async () => {
    await fetch("/api/session/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };
  return (
    <div className="shell">
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="side-head"><Logo inverse /><button className="icon-button mobile-only" onClick={() => setOpen(false)} aria-label="Close menu"><X size={20}/></button></div>
        <nav className="side-nav">
          <p>WORKSPACE</p>
          {nav.map(item => <Link key={item.label} href={item.href} onClick={() => setOpen(false)} className={path === item.href ? "active" : ""}><item.icon size={18}/><span>{item.label}</span></Link>)}
        </nav>
        <div className="side-notice"><ShieldCheck size={18}/><div><strong>Human-led review</strong><span>Analysis organises evidence. Officers make every decision.</span></div></div>
        <div className="officer-profile"><span>AS</span><div><strong>Authenticated officer</strong><small>Cybercrime Review Officer</small></div><button className="icon-button" onClick={logout} aria-label="Sign out"><LogOut size={17}/></button></div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-only" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={21}/></button>
          <div className="officer-top-context"><span>OFFICER WORKSPACE</span><strong>Cybercrime Operations Centre</strong></div>
          <div className="topbar-right"><button className={`backend-sync backend-sync-${syncState}`} onClick={() => void retrySync()} disabled={syncState === "loading"}>{syncState === "loading" ? <LoaderCircle/> : syncState === "synced" ? <Cloud/> : <CloudOff/>}<span>{syncState === "synced" ? "Database synced" : syncState === "loading" ? "Checking database" : "Sync needs attention"}</span>{syncState === "error" && <RefreshCw/>}</button><POVSwitch current="officer"/></div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
