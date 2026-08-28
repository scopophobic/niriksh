"use client";

import { ArrowLeftRight, BadgeCheck, Shield, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function POVSwitch({ current }: { current: "citizen" | "officer" }) {
  const router = useRouter();
  const [switching, setSwitching] = useState(false);
  const target = current === "citizen" ? "officer" : "citizen";
  const destination = target === "officer" ? "/dashboard" : "/track";

  const switchView = () => {
    if (switching) return;
    setSwitching(true);
    window.setTimeout(() => router.push(destination), 1050);
  };

  return <>
    <button className={`pov-switch pov-switch-${current}`} onClick={switchView} aria-label={`Switch to ${target} view`}>
      <span className="pov-switch-icon">{target === "officer" ? <Shield size={15}/> : <UserRound size={15}/>}</span>
      <span><small>SWITCH VIEW</small><strong>{target === "officer" ? "Officer workspace" : "Citizen portal"}</strong></span>
      <ArrowLeftRight size={15}/>
    </button>
    {switching && <div className="pov-transition" role="status" aria-live="polite">
      <div className="pov-transition-card">
        <div className="pov-transition-mark">
          <span>{target === "officer" ? <Shield size={27}/> : <UserRound size={27}/>}</span>
          <i><BadgeCheck size={14}/></i>
        </div>
        <small>ONE PLATFORM · TWO CLEAR VIEWS</small>
        <h2>Switching to the {target === "officer" ? "officer workspace" : "citizen portal"}</h2>
        <p>{target === "officer" ? "Opening case review, analysis and routing tools…" : "Opening your complaints, updates and guidance…"}</p>
        <div className="pov-loading"><span/><span/><span/></div>
      </div>
    </div>}
  </>;
}
