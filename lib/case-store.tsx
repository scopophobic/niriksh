"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { DEMO_CASES, withCurrentAnalysis } from "./mock-data";
import { TriageCase } from "./types";

interface CaseStoreValue {
  cases: TriageCase[];
  getCase: (id: string) => TriageCase | undefined;
  addCase: (item: TriageCase) => void;
  updateCase: (id: string, patch: Partial<TriageCase>) => void;
  resetDemo: () => void;
}

const CaseStore = createContext<CaseStoreValue | null>(null);
const STORAGE_KEY = "niriksh-demo-cases-v2";

export function CaseStoreProvider({ children }: { children: React.ReactNode }) {
  const [cases, setCases] = useState<TriageCase[]>(DEMO_CASES);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const restore = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) setCases((JSON.parse(saved) as TriageCase[]).map(withCurrentAnalysis));
      } catch { /* fall back to seed data */ }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(restore);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
  }, [cases, hydrated]);

  const updateCase = (id: string, patch: Partial<TriageCase>) => setCases(items => items.map(item => item.id === id ? { ...item, ...patch } : item));
  const addCase = (item: TriageCase) => setCases(items => [item, ...items.filter(existing => existing.id !== item.id)]);
  const resetDemo = () => { setCases(DEMO_CASES); localStorage.removeItem(STORAGE_KEY); };

  return <CaseStore.Provider value={{ cases, getCase: id => cases.find(item => item.id === id), addCase, updateCase, resetDemo }}>{children}</CaseStore.Provider>;
}

export function useCaseStore() {
  const value = useContext(CaseStore);
  if (!value) throw new Error("useCaseStore must be used inside CaseStoreProvider");
  return value;
}
