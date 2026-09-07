"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, Cloud, CloudOff, LayoutDashboard, LoaderCircle, LogOut, Menu, RefreshCw, Route, Settings2, ShieldCheck, Sparkles, Video, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { POVSwitch } from "./POVSwitch";
import { useCaseStore } from "@/lib/case-store";

const navGroups = [
  { label: "Intelligence", items: [
    { href: "/prevention", label: "Intelligence overview", icon: Sparkles },
    { href: "/awareness", label: "Awareness studio", icon: Video },
  ]},
  { label: "Casework", items: [
    { href: "/dashboard", label: "Cases", icon: LayoutDashboard },
  ]},
  { label: "Operations", items: [
    { href: "/routing", label: "Routing desk", icon: Route },
  ]},
];

const demoSteps = [
  { href: "/dashboard", short: "Cases", label: "Review a case", detail: "Open a fictional complaint and inspect its timeline, evidence sources and missing details." },
  { href: "/prevention", short: "Intelligence", label: "Connect the signals", detail: "Open a pattern and compare the exact identifiers shared across otherwise separate reports." },
  { href: "/awareness", short: "Awareness", label: "Draft a warning", detail: "Turn human-reviewed intelligence into a controlled awareness draft without auto-publishing it." },
];

type OfficerSession = { email: string; role: string };

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<OfficerSession>();
  const [sessionError, setSessionError] = useState(false);
  const [sessionCheck, setSessionCheck] = useState(0);
  const { syncState, retrySync } = useCaseStore();
  const demoStep = path.startsWith("/prevention") ? 1 : path.startsWith("/awareness") ? 2 : 0;
  const nextDemoStep = demoSteps[(demoStep + 1) % demoSteps.length];

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/session", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (response.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(path)}`);
          return;
        }
        if (!response.ok) throw new Error("Session check failed");
        setSession(await response.json() as OfficerSession);
      })
      .catch(error => {
        if (error instanceof Error && error.name !== "AbortError") setSessionError(true);
      });
    return () => controller.abort();
  }, [path, router, sessionCheck]);
  const logout = async () => {
    await fetch("/api/session/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  if (!session) return <main className="officer-session-check">
    <Logo/>
    {sessionError ? <><ShieldCheck/><h1>We could not verify this officer session.</h1><p>The service may be restarting. Retry the check or return to sign in.</p><div><button className="button button-primary" onClick={() => { setSessionError(false); setSessionCheck(value => value + 1); }}>Retry session check</button><Link className="button button-ghost" href={`/login?next=${encodeURIComponent(path)}`}>Return to sign in</Link></div></> : <><LoaderCircle/><h1>Opening the officer workspace…</h1><p>Verifying the signed session before loading case material.</p></>}
  </main>;

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="side-head"><Logo inverse /><button className="icon-button mobile-only" onClick={() => setOpen(false)} aria-label="Close menu"><X size={20}/></button></div>
        <nav className="side-nav">
          {navGroups.map(group => <div key={group.label} className="side-nav-group"><p>{group.label}</p>{group.items.map(item => <Link key={item.label} href={item.href} onClick={() => setOpen(false)} className={(path === item.href || (item.href === "/prevention" && path.startsWith("/prevention/"))) ? "active" : ""}><item.icon size={18}/><span>{item.label}</span></Link>)}</div>)}
          <div className="side-nav-group side-nav-admin"><p>System</p><Link href="/admin" onClick={() => setOpen(false)} className={path === "/admin" ? "active" : ""}><Settings2 size={18}/><span>Administration</span></Link></div>
        </nav>
        <section className="side-demo-guide" aria-label="Demo walkthrough">
          <div className="side-demo-guide-head"><Sparkles/><span><small>DEMO WALKTHROUGH</small><strong>{demoSteps[demoStep].label}</strong></span><b>{demoStep + 1}/3</b></div>
          <div className="side-demo-progress">{demoSteps.map((step, index) => <Link key={step.href} href={step.href} className={index === demoStep ? "active" : index < demoStep ? "complete" : ""} aria-label={`Step ${index + 1}: ${step.label}`}><i>{index + 1}</i><span>{step.short}</span></Link>)}</div>
          <p>{demoSteps[demoStep].detail}</p>
          <Link className="side-demo-next" href={nextDemoStep.href}>{demoStep === demoSteps.length - 1 ? "Restart at cases" : `Next: ${nextDemoStep.short}`}<ArrowRight/></Link>
        </section>
        <div className="side-notice"><ShieldCheck size={18}/><div><strong>Human-led review</strong><span>Analysis organises evidence. Officers make every decision.</span></div></div>
        <div className="officer-profile"><span>{session.email.slice(0, 2).toUpperCase()}</span><div><strong>{session.email}</strong><small>{session.role === "admin" ? "Administrator" : "Cybercrime Review Officer"}</small></div><button className="icon-button" onClick={logout} aria-label="Sign out"><LogOut size={17}/></button></div>
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
