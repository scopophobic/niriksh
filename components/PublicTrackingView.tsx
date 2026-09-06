"use client";

import Link from "next/link";
import {
  AlertCircle,
  BadgeCheck,
  CalendarClock,
  Check,
  ClipboardList,
  Info,
  Landmark,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type TrackingUpdate = {
  id: string;
  type: string;
  label: string;
  message: string;
  created_at: string;
};

type TrackingRecord = {
  tracking_number: string;
  case_status: string;
  registered_at: string;
  last_updated_at: string;
  category: string;
  assigned_unit: string;
  report_prepared: boolean;
  report_version: number | null;
  needs_information: boolean;
  requested_information: string[];
  updates: TrackingUpdate[];
  guidance: string[];
  disclaimer: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function PublicTrackingView({ token }: { token: string }) {
  const [record, setRecord] = useState<TrackingRecord | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchRecord = useCallback(async () => {
    const response = await fetch(`/api/public/tracking/${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.detail || payload.error || "This tracking link is unavailable.");
    return payload as TrackingRecord;
  }, [token]);

  useEffect(() => {
    let active = true;
    fetchRecord()
      .then(payload => {
        if (active) setRecord(payload);
      })
      .catch(caught => {
        if (active) setError(caught instanceof Error ? caught.message : "This tracking link is unavailable.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchRecord]);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      setRecord(await fetchRecord());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This tracking link is unavailable.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="public-tracking-state"><LoaderCircle className="tracking-spinner" size={28}/><h1>Loading your case update</h1><p>Connecting securely to Niriksh.</p></div>;
  }

  if (error || !record) {
    return <div className="public-tracking-state public-tracking-error"><AlertCircle size={30}/><h1>We could not open this tracking link</h1><p>{error || "The link may be invalid or expired."}</p><button onClick={refresh}><RefreshCw size={15}/> Try again</button><Link href="/">Return to Niriksh</Link></div>;
  }

  const statusClass = record.case_status.toLowerCase().replaceAll(" ", "-");
  const updates = [...record.updates].reverse();

  return <div className="citizen-dashboard-page public-tracking-page">
    <section className="citizen-welcome">
      <div><span className="citizen-kicker"><BadgeCheck size={15}/> SECURE CASE PORTAL</span><h1>Your complaint, clearly tracked.</h1><p>This private link shows safe status updates without exposing your complaint or evidence.</p></div>
      <button className="citizen-primary" onClick={refresh}><RefreshCw size={17}/> Refresh status</button>
    </section>

    <section className="citizen-case-hero">
      <div className="citizen-case-hero-top">
        <div><small>TRACKING NUMBER</small><h2>{record.tracking_number}</h2><p>Registered {formatDate(record.registered_at)}</p></div>
        <span className={`citizen-status citizen-status-${statusClass}`}><i/>{record.case_status}</span>
      </div>
      <div className="citizen-current-update">
        <ShieldCheck size={20}/>
        <div><small>LAST UPDATED · {formatDate(record.last_updated_at)}</small><strong>{record.needs_information ? "The review team needs more information" : "Your complaint is in the Niriksh review process"}</strong><p>{record.needs_information ? "Keep the requested details ready and use the official contact method provided by the review team." : "No response is required unless the review team asks for another detail."}</p></div>
      </div>
    </section>

    <div className="citizen-detail-columns public-tracking-columns">
      <div className="citizen-detail-main">
        {record.needs_information && <section className="citizen-panel tracking-request-panel">
          <div className="citizen-panel-heading"><div><span><ClipboardList size={17}/></span><div><small>ACTION NEEDED</small><h2>Information requested</h2></div></div></div>
          <ul>{record.requested_information.map(item => <li key={item}>{item}</li>)}</ul>
          <p>Use only the official contact method provided by the review team. Do not share passwords, PINs, recovery codes, or OTPs.</p>
        </section>}

        <section className="citizen-panel update-timeline-panel">
          <div className="citizen-panel-heading"><div><span><CalendarClock size={17}/></span><div><small>CASE HISTORY</small><h2>Status updates</h2></div></div></div>
          <div className="citizen-update-timeline">
            {updates.map((update, index) => <div className={index === 0 ? "latest" : ""} key={update.id}><i><Check size={13}/></i><span><small>{formatDate(update.created_at)}</small><strong>{update.label}</strong><p>{update.message}</p></span></div>)}
          </div>
        </section>

        <section className="citizen-guidance-card">
          <div><span><ShieldCheck size={20}/></span><div><small>SAFETY GUIDANCE</small><h2>What you should do now</h2></div></div>
          <div className="citizen-guidance-grid">{record.guidance.map((item, index) => <span key={item}><i>{String(index + 1).padStart(2, "0")}</i><strong>{index === 0 ? "Protect evidence" : index === 1 ? "Keep the reference" : "Get urgent help"}</strong><p>{item}</p></span>)}</div>
          <div className="guidance-warning"><AlertCircle size={16}/><span><strong>Never share an OTP, PIN, password, or recovery code.</strong> Niriksh will not ask for one through this tracking page.</span></div>
        </section>
      </div>

      <aside className="citizen-detail-aside">
        <section className="citizen-route-card"><Landmark size={19}/><small>REVIEW ROUTE</small><h3>{record.assigned_unit}</h3><p>{record.category || "Category confirmation in progress"}</p><span><Check size={14}/>Human confirmation required</span></section>
        <section className="citizen-help-card"><Info size={19}/><div><strong>Report status</strong><p>{record.report_prepared ? `A structured report is ready (version ${record.report_version}).` : "The structured report is being prepared."}</p></div></section>
        <section className="citizen-panel tracking-disclaimer"><Info size={17}/><p>{record.disclaimer}</p><Link href="/">Return to Niriksh</Link></section>
      </aside>
    </div>
  </div>;
}
