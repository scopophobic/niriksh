"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { KeyRound, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";

function LoginForm() {
  const search = useSearchParams();
  const [email, setEmail] = useState("triage@example.local");
  const [password, setPassword] = useState("12345678");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/session/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Sign-in failed");
      const destination = search.get("next");
      const safeDestination = destination?.startsWith("/") && !destination.startsWith("//") ? destination : "/dashboard";
      window.location.assign(safeDestination);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign-in failed");
      setBusy(false);
    }
  };

  return <main className="officer-login-page">
    <section className="officer-login-card">
      <Link href="/" className="officer-login-brand"><Logo/></Link>
      <h1>Officer sign in</h1>
      <p>Case material and routing actions are available only to authenticated reviewers.</p>
      <aside className="officer-demo-access" aria-label="Demo account details">
        <div className="officer-demo-access-head"><span><Sparkles/></span><div><small>READY-TO-USE DEMO</small><strong>Explore with fictional case data</strong></div></div>
        <dl><div><dt>Login ID</dt><dd>triage@example.local</dd></div><div><dt>Password</dt><dd>12345678</dd></div></dl>
        <button type="button" onClick={() => { setEmail("triage@example.local"); setPassword("12345678"); setError(""); }}><KeyRound/>Restore demo credentials</button>
      </aside>
      <form onSubmit={submit}>
        <label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="username" required/></label>
        <label>Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" minLength={8} required/></label>
        {error && <div className="officer-login-error" role="alert">{error}</div>}
        <button className="button button-primary" disabled={busy}>{busy ? "Signing in…" : "Sign in securely"}</button>
      </form>
      <div className="officer-login-note"><ShieldCheck/><span>The signed session is stored in an HTTP-only cookie and expires automatically.</span></div>
    </section>
  </main>;
}

export default function LoginPage() {
  return <Suspense><LoginForm/></Suspense>;
}
