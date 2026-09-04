"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { DEMO_CASES, withCurrentAnalysis } from "./mock-data";
import { TriageCase } from "./types";

interface CaseStoreValue {
  cases: TriageCase[];
  syncState: "loading" | "synced" | "offline" | "error";
  getCase: (id: string) => TriageCase | undefined;
  addCase: (item: TriageCase) => Promise<TriageCase & { _uploadToken?: string }>;
  updateCase: (id: string, patch: Partial<TriageCase>) => void;
  resetDemo: () => void;
  retrySync: () => Promise<void>;
}

const CaseStore = createContext<CaseStoreValue | null>(null);
const STORAGE_KEY = "niriksh-demo-cases-v2";
const PENDING_KEY = "niriksh-pending-sync-v1";
const hydrateCase = (item: TriageCase) => item.analysisDetails ? item : withCurrentAnalysis(item);
type PendingOperation = { kind: "create" | "update"; id: string; payload: TriageCase | Partial<TriageCase> };

export function CaseStoreProvider({ children }: { children: React.ReactNode }) {
  const [cases, setCases] = useState<TriageCase[]>(DEMO_CASES);
  const [hydrated, setHydrated] = useState(false);
  const [syncState, setSyncState] = useState<"loading" | "synced" | "offline" | "error">("loading");

  const pendingOperations = () => {
    try { return JSON.parse(localStorage.getItem(PENDING_KEY) || "[]") as PendingOperation[]; }
    catch { return [] as PendingOperation[]; }
  };
  const enqueue = (operation: PendingOperation) => {
    const current = pendingOperations();
    const previous = current.find(item => item.kind === operation.kind && item.id === operation.id);
    const pending = current.filter(item => !(item.kind === operation.kind && item.id === operation.id));
    const next = previous && operation.kind === "update"
      ? { ...operation, payload: { ...previous.payload, ...operation.payload } }
      : operation;
    localStorage.setItem(PENDING_KEY, JSON.stringify([...pending, next]));
    setSyncState("error");
  };

  useEffect(() => {
    let cancelled = false;
    const restore = window.setTimeout(async () => {
      let localCases = DEMO_CASES;
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) localCases = (JSON.parse(saved) as TriageCase[]).map(hydrateCase);
      } catch { /* fall back to seed data */ }
      try {
        const response = await fetch("/api/cases", { cache: "no-store" });
        if (response.ok) {
          const persisted = (await response.json() as TriageCase[]).map(hydrateCase);
          const merged = [...persisted, ...localCases.filter(local => !persisted.some(remote => remote.id === local.id))];
          if (!cancelled) { setCases(merged); setSyncState("synced"); }
        } else if (!cancelled) { setCases(localCases); setSyncState(response.status === 401 ? "offline" : "error"); }
      } catch {
        if (!cancelled) { setCases(localCases); setSyncState("offline"); }
      }
      if (!cancelled) setHydrated(true);
    }, 0);
    return () => { cancelled = true; window.clearTimeout(restore); };
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
  }, [cases, hydrated]);

  const updateCase = (id: string, patch: Partial<TriageCase>) => {
    setCases(items => items.map(item => item.id === id ? { ...item, ...patch } : item));
    void fetch(`/api/cases/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then(response => {
      if (!response.ok) enqueue({ kind: "update", id, payload: patch });
      else setSyncState("synced");
    }).catch(() => enqueue({ kind: "update", id, payload: patch }));
  };
  const addCase = async (item: TriageCase) => {
    setCases(items => [item, ...items.filter(existing => existing.id !== item.id)]);
    try {
      const response = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      if (!response.ok) { enqueue({ kind: "create", id: item.id, payload: item }); return item; }
      const responseCase = await response.json() as TriageCase & { _uploadToken?: string };
      const uploadToken = responseCase._uploadToken;
      const { _uploadToken: _discarded, ...caseWithoutToken } = responseCase;
      void _discarded;
      const persisted = hydrateCase(caseWithoutToken as TriageCase);
      setCases(items => [persisted, ...items.filter(existing => existing.id !== persisted.id)]);
      setSyncState("synced");
      return { ...persisted, _uploadToken: uploadToken };
    } catch {
      enqueue({ kind: "create", id: item.id, payload: item });
      return item;
    }
  };
  const retrySync = async () => {
    const pending = pendingOperations();
    if (!pending.length) { setSyncState("synced"); return; }
    setSyncState("loading");
    const remaining: PendingOperation[] = [];
    for (const operation of pending) {
      try {
        const response = await fetch(operation.kind === "create" ? "/api/cases" : `/api/cases/${encodeURIComponent(operation.id)}`, {
          method: operation.kind === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(operation.payload),
        });
        if (!response.ok) remaining.push(operation);
        else if (operation.kind === "create") {
          const responseCase = await response.json() as TriageCase & { _uploadToken?: string };
          const { _uploadToken: _discarded, ...caseWithoutToken } = responseCase;
          void _discarded;
          const persisted = hydrateCase(caseWithoutToken as TriageCase);
          setCases(items => [persisted, ...items.filter(existing => existing.id !== persisted.id)]);
        }
      } catch { remaining.push(operation); }
    }
    localStorage.setItem(PENDING_KEY, JSON.stringify(remaining));
    setSyncState(remaining.length ? "error" : "synced");
  };
  const resetDemo = () => { setCases(DEMO_CASES); localStorage.removeItem(STORAGE_KEY); };

  return <CaseStore.Provider value={{ cases, syncState, getCase: id => cases.find(item => item.id === id), addCase, updateCase, resetDemo, retrySync }}>{children}</CaseStore.Provider>;
}

export function useCaseStore() {
  const value = useContext(CaseStore);
  if (!value) throw new Error("useCaseStore must be used inside CaseStoreProvider");
  return value;
}
