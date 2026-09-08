"use client";

// The native WhatsApp-style chat demo for /whatsapp — ported from Bhumika's umang-reimagined
// repo (app/niriksh/NirikshLanding.js) per docs/whatsapp-demo.md. Unlike that original, a
// finished checklist here produces a REAL niriksh case: no Bhumika server, no external
// contract — the same analyzeComplaint()/addCase() pipeline ReportFlow.tsx's guided form uses.

import { ChangeEvent, ReactElement, useCallback, useEffect, useRef, useState } from "react";
import { analyzeComplaint } from "@/lib/analyzer";
import { addLocalEngine } from "@/lib/multimodal";
import { base64ToFile, prepareFile } from "@/lib/evidence";
import { useCaseStore } from "@/lib/case-store";
import { checklistToComplaintDetails, buildNarrative } from "@/lib/whatsapp-mapping";
import {
  CATEGORIES, CategoryKey, ChatButton, ChecklistRow, Fields, Values,
  checklistView, mergeFields, mergeValues, missingFields, nextReply, sendButtons,
} from "@/lib/whatsapp-classifier";
import { resolveLanguage, t } from "@/lib/whatsapp-i18n";
import { ComplaintDetails, EvidenceItem, TriageCase } from "@/lib/types";

const SCENARIOS: Array<{ emoji: string; label: string; text: string; needs: string }> = [
  {
    emoji: "💸",
    label: "Phishing & payment loss",
    text: "I lost ₹58,240 to a phishing scam — a fraud link came through a text message and the money was transferred out before I could stop it. The UTR number is 304871562938.",
    needs: "UTR, bank/account, amount, date",
  },
  {
    emoji: "⚠️",
    label: "Threatening messages",
    text: "Someone has been sending me threatening messages from an unknown number and I'm scared. I have screenshots of the messages.",
    needs: "chat screenshot, sender's number",
  },
  {
    emoji: "🎭",
    label: "Investment deepfake",
    text: "I saw a video of a well-known businessman promising guaranteed returns and invested money through the link, but I think the video was fake and now I can't reach anyone.",
    needs: "video/link, where the money went",
  },
  {
    emoji: "🛡️",
    label: "Child-safety risk",
    text: "I came across an AI-generated video online that appears to involve a child in a way that worries me, and I want to report it urgently before it spreads further.",
    needs: "is it still up, your relationship to the child",
  },
];

const STATES = ["Assam", "Delhi", "Karnataka", "Maharashtra", "Rajasthan", "Tamil Nadu", "Uttar Pradesh", "West Bengal", "Other / not listed"];
const MAX_EVIDENCE_BYTES = 10_000_000;

interface ChatMessage {
  who: "me" | "bot";
  kind: string;
  body: string;
  buttons?: ChatButton[];
}

interface NirikshState {
  category: CategoryKey;
  categoryLabel: string;
  checklist: Fields;
  checklistView: ChecklistRow[];
  values: Values;
  ready?: boolean;
  summary: string;
  language?: string;
}

// The one shape /api/mock/whatsapp-chat ever replies with — skim and full responses are both
// partial views of this, so a single interface keeps the two request tiers from silently
// drifting into incompatible shapes.
interface ChatApiResponse {
  category?: CategoryKey;
  categoryLabel?: string;
  checklist?: Fields;
  checklistView?: ChecklistRow[];
  values?: Values;
  summary?: string;
  ready?: boolean;
  retracted?: string[];
  skipped?: boolean;
  provisional?: boolean;
  discarded?: boolean;
  readyToSubmit?: boolean;
  error?: string;
  messages?: Array<{ kind: string; body: string; buttons?: ChatButton[] }>;
  language?: string;
}

interface EvidenceRefItem {
  base64: string;
  mimeType: string;
  kind: string;
  name: string;
}

interface SubmissionIdentity {
  id: string;
  createdAt: string;
  placeholderReference: string;
}

// niriksh's own inline markdown: *bold*, _italic_, ~strikethrough~, `code`, and (new here vs
// the Bhumika original) bare URLs made clickable — the mock is the one surface that has to do
// this explicitly, since real WhatsApp autolinks URLs itself. URL comes first in the
// alternation so the italic rule's underscore-matching can't consume characters inside a link.
const WA_FORMAT_RE = /(https?:\/\/[^\s*_~`]+)|```([^`\n]+?)```|`([^`\n]+?)`|\*([^*\n]+?)\*|_([^_\n]+?)_|~([^~\n]+?)~/g;

function formatWhatsAppText(text: string) {
  if (!text) return text;
  const nodes: Array<string | ReactElement> = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  WA_FORMAT_RE.lastIndex = 0;
  while ((match = WA_FORMAT_RE.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const [, url, mono, code, bold, italic, strike] = match;
    if (url !== undefined) {
      nodes.push(<a key={key++} href={url} target="_blank" rel="noopener noreferrer">{url}</a>);
    } else if (mono !== undefined || code !== undefined) {
      nodes.push(<code key={key++}>{mono ?? code}</code>);
    } else if (bold !== undefined) {
      nodes.push(<strong key={key++}>{bold}</strong>);
    } else if (italic !== undefined) {
      nodes.push(<em key={key++}>{italic}</em>);
    } else {
      nodes.push(<s key={key++}>{strike}</s>);
    }
    lastIndex = WA_FORMAT_RE.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise(resolve => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result).split(",")[1]);
    r.readAsDataURL(blob);
  });
}

export function WhatsAppDemo({ aiConfigured }: { aiConfigured: boolean }) {
  const { addCase } = useCaseStore();
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [niriksh, setNiriksh] = useState<NirikshState | null>(null);
  const [recording, setRecording] = useState(false);
  const [pickingLocation, setPickingLocation] = useState(false);
  const [locState, setLocState] = useState("");
  const [locDistrict, setLocDistrict] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Keep one identity across retries. If the first response is lost after Niriksh accepted the
  // complaint, retrying with the same id and timestamp recovers it instead of creating a copy.
  const submissionRef = useRef<SubmissionIdentity | null>(null);
  // Every file sent this case, kept so it can become a real EvidenceItem at submit time. The
  // server keeps no session, so a photo shared on turn 2 has to still be there when the
  // citizen confirms on turn 6 — the client is what holds it.
  const evidenceRef = useRef<EvidenceRefItem[]>([]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat, typing]);

  const submitCase = useCallback(async (finished: NirikshState) => {
    const narrative = buildNarrative({ category: finished.category, values: finished.values, summary: finished.summary });
    const details: ComplaintDetails = checklistToComplaintDetails({ category: finished.category, values: finished.values, confirmed: true });

    const files: EvidenceItem[] = [];
    const sourceFiles: Record<string, File> = {};
    for (const item of evidenceRef.current) {
      const file = base64ToFile(item);
      const prepared = await prepareFile(file);
      files.push(prepared);
      if (prepared.sha256) sourceFiles[prepared.sha256] = file;
    }

    const local = analyzeComplaint(narrative, files, details);
    const result = addLocalEngine(local, files.length, aiConfigured
      ? "The connected analysis pipeline was not run for this chat-filed case."
      : "Connected analysis is unavailable. Uploaded media was not interpreted automatically.");
    const identity = submissionRef.current || (() => {
      const now = new Date();
      const next = {
        id: `whatsapp-${crypto.randomUUID()}`,
        createdAt: now.toISOString(),
        placeholderReference: `PENDING-${now.getUTCFullYear()}-${String(now.getTime()).slice(-6)}`,
      };
      submissionRef.current = next;
      return next;
    })();
    const newCase: TriageCase = {
      id: identity.id,
      reference: identity.placeholderReference,
      description: narrative,
      summary: result.summary,
      category: result.category,
      secondary: result.secondary,
      severity: result.severity,
      severityScore: result.score,
      status: "Awaiting review",
      completeness: result.completeness,
      aiSuspected: result.aiSuspected,
      createdAt: identity.createdAt,
      createdLabel: "Just now",
      platform: details.channel,
      location: [details.district, details.state].filter(Boolean).join(", "),
      department: result.departments,
      entities: result.entities,
      evidence: files,
      missing: result.missing,
      riskFactors: result.riskFactors,
      confidence: result.confidence,
      analysisDetails: result,
      complaintDetails: details,
      citizenVerification: {
        status: "Confirmed",
        summaryConfirmed: true,
        confirmedEntities: result.entities.length,
        totalEntities: result.entities.length,
        confirmedAt: "Just now",
      },
      audit: [
        { label: "Complaint filed via WhatsApp-style guided chat", detail: "The reporter completed the chat checklist and confirmed submission.", time: "Just now", actor: "Complainant" },
        { label: "Structured intake completed", detail: "Context, sources, missing details and a human-selected subject folder were prepared without automated priority scoring.", time: "Just now", actor: "Niriksh Analysis" },
      ],
    };

    const persisted = await addCase(newCase, { persistOnly: true });
    // `persistOnly` keeps an unconfirmed local placeholder out of the citizen portal. A response
    // carrying `_uploadToken` is the signal that the backend accepted or recovered this case.
    if (!persisted._uploadToken) {
      return { ok: false as const, filed: false as const };
    }

    const uploads = await Promise.allSettled(files.map(async item => {
      const source = item.sha256 ? sourceFiles[item.sha256] : undefined;
      if (!source) return;
      const form = new FormData();
      form.append("evidence", source, source.name);
      form.append("evidence_type", item.type);
      if (item.purpose) form.append("purpose", item.purpose);
      if (item.originality) form.append("originality", item.originality);
      if (item.contextNote) form.append("context_note", item.contextNote);
      if (item.sha256?.match(/^[a-f0-9]{64}$/i)) form.append("expected_sha256", item.sha256);
      const response = await fetch(`/api/cases/${encodeURIComponent(persisted.id)}/evidence`, {
        method: "POST",
        headers: { "X-Complaint-Token": persisted._uploadToken! },
        body: form,
      });
      if (!response.ok) throw new Error(`Evidence upload failed with HTTP ${response.status}`);
    }));

    if (uploads.some(upload => upload.status === "rejected")) {
      return { ok: false as const, filed: true as const, reference: persisted.reference };
    }

    submissionRef.current = null;
    return { ok: true as const, reference: persisted.reference };
  }, [addCase, aiConfigured]);

  const call = useCallback(async (payload: Record<string, unknown>, myBubble?: string) => {
    if (busy) return;
    setBusy(true);
    if (myBubble) setChat(c => [...c, { who: "me", kind: String(payload.type || "text"), body: myBubble }]);
    setChat(c => [...c, { who: "bot", kind: "processing", body: "One moment — I'm reading your message and checking what Niriksh will need." }]);
    setTyping(true);

    const postBot = (msgs: Array<{ kind: string; body: string; buttons?: ChatButton[] }>) => {
      if (!msgs.length) return;
      setChat(c => [
        ...c.filter(m => m.kind !== "processing"),
        ...msgs.map(m => ({ who: "bot" as const, kind: m.kind, body: m.body, buttons: m.buttons })),
      ]);
    };

    try {
      const history = chat.filter(m => m.who === "me" && m.kind === "text").map(m => m.body);
      if (payload.mediaBase64) {
        evidenceRef.current = [...evidenceRef.current, {
          base64: payload.mediaBase64 as string,
          mimeType: payload.mimeType as string,
          kind: String(payload.type),
          name: (payload.fileName as string) || `${payload.type}-${evidenceRef.current.length + 1}`,
        }].slice(-6);
      }
      const base = {
        history,
        category: niriksh?.category || null,
        checklist: niriksh?.checklist || null,
        values: niriksh?.values || null,
        summary: niriksh?.summary || "",
        language: niriksh?.language || null,
      };
      const post = (extra: Record<string, unknown>): Promise<ChatApiResponse> => fetch("/api/mock/whatsapp-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...base, ...payload, ...extra }),
      }).then(r => r.json());

      const pendingMedia = payload.mediaBase64 ? (payload.type as string) || "document" : null;
      const skimPromise: Promise<ChatApiResponse> = payload.type === "button"
        ? Promise.resolve({ skipped: true })
        : post({ mode: "skim", pendingMedia, mediaBase64: undefined, mimeType: undefined });
      const fullPromise = post({ mode: "full" });

      // A plain object cell rather than a bare `let` — TypeScript's control-flow narrowing
      // otherwise gets confused about a `let` binding reassigned only from inside a promise
      // callback, and narrows later reads of it to `never`.
      const skimmedBox: { value: ChatApiResponse | null } = { value: null };
      let fullLanded = false;
      skimPromise.then((data: ChatApiResponse) => {
        if (fullLanded || !data?.category || data.skipped) return;
        skimmedBox.value = data;
        postBot(data.messages || []);
        setNiriksh(prev => ({
          category: data.category!,
          categoryLabel: data.categoryLabel || CATEGORIES[data.category!].label,
          checklist: data.checklist!,
          checklistView: data.checklistView!,
          values: prev?.values || data.values || {},
          summary: prev?.summary || data.summary || "",
          language: data.language || prev?.language,
        }));
      }).catch(() => { /* best-effort tier */ });

      const data = await fullPromise;
      fullLanded = true;

      if (data.readyToSubmit && data.category) {
        setTyping(false);
        const finished: NirikshState = {
          category: data.category,
          categoryLabel: data.categoryLabel || CATEGORIES[data.category].label,
          checklist: data.checklist || {},
          checklistView: [],
          values: data.values || {},
          summary: data.summary || "",
        };
        setChat(c => [
          ...c.filter(m => m.kind !== "processing"),
          { who: "bot", kind: "text", body: "Filing this with Niriksh now — one moment…" },
        ]);
        const outcome = await submitCase(finished);
        if (outcome.ok) {
          const origin = typeof window !== "undefined" ? window.location.origin : "";
          setChat(c => [...c, {
            who: "bot", kind: "text",
            body: `📨 *Filed with Niriksh.* This *${finished.categoryLabel}* case is now in evidence review.\n\n🔖 Your reference: *${outcome.reference}*\n\nKeep that reference — it's how this case is tracked. See it on this device at ${origin}/track?ref=${encodeURIComponent(outcome.reference || "")}`,
          }]);
          setNiriksh(null);
          evidenceRef.current = [];
        } else if (outcome.filed) {
          setChat(c => [...c, {
            who: "bot", kind: "text",
            body: `📨 *Complaint registered with Niriksh* under reference *${outcome.reference}*, but I could not confirm every evidence upload. Keep this chat open and tap *Send now* again to retry the missing upload safely.`,
          }]);
        } else {
          setChat(c => [...c, {
            who: "bot", kind: "text",
            body: "I couldn't confirm whether Niriksh received this just now. Nothing you told me is lost — tap *Send now* again in a moment and I'll safely check the same submission.",
          }]);
        }
        return;
      }

      postBot((data.messages || [{ kind: "text", body: data.error || "Something went wrong." }]).filter(m => m.kind !== "processing"));
      if (data.discarded) {
        setNiriksh(null);
        evidenceRef.current = [];
        submissionRef.current = null;
      } else if (data.category) {
        const retracted = new Set(data.retracted || []);
        const skimmed = skimmedBox.value;
        const checklist = skimmed?.category === data.category && data.checklist
          ? Object.fromEntries(Object.keys(data.checklist).map(k => [
              k,
              retracted.has(k) ? Boolean(data.checklist![k]) : Boolean(data.checklist![k]) || Boolean(skimmed?.checklist?.[k]),
            ]))
          : data.checklist || {};
        setNiriksh({
          category: data.category,
          categoryLabel: data.categoryLabel || CATEGORIES[data.category].label,
          checklist,
          checklistView: (data.checklistView || []).map(f => ({ ...f, done: Boolean(checklist[f.key]) })),
          values: data.values || {},
          ready: data.ready,
          summary: data.summary || "",
          language: data.language || niriksh?.language,
        });
      }
    } catch {
      setChat(c => [
        ...c.filter(m => m.kind !== "processing"),
        { who: "bot", kind: "text", body: "I couldn't reach the service this time. Please try again." },
      ]);
    } finally {
      setTyping(false);
      setBusy(false);
    }
  }, [busy, chat, niriksh, submitCase]);

  function cancelRecording() {
    const mr = recorderRef.current;
    if (!mr || mr.state === "inactive") return;
    mr.onstop = () => mr.stream?.getTracks().forEach(t => t.stop());
    mr.stop();
    setRecording(false);
  }

  const sendText = (text: string) => { if (!text.trim()) return; setInput(""); call({ type: "text", text }, text); };
  const sendScenario = (s: typeof SCENARIOS[number]) => { cancelRecording(); sendText(s.text); };
  const tapButton = (b: ChatButton) => { cancelRecording(); call({ type: "button", buttonId: b.id }, b.title); };

  const openLocationPicker = () => { cancelRecording(); setPickingLocation(true); };
  const confirmLocation = () => {
    setPickingLocation(false);
    if (!niriksh || !locState) return;
    const fields = mergeFields(niriksh.category, niriksh.checklist, { state: true, district: Boolean(locDistrict) });
    const values = mergeValues(niriksh.category, niriksh.values, { state: locState, district: locDistrict });
    const ready = missingFields(niriksh.category, fields, values).required.length === 0;
    const language = resolveLanguage(niriksh.language);
    const view = checklistView(niriksh.category, fields, values, language);
    const reply = nextReply({ category: niriksh.category, fields, values, summary: niriksh.summary, language });
    setChat(c => [
      ...c,
      { who: "me", kind: "text", body: `📍 ${[locDistrict, locState].filter(Boolean).join(", ")}` },
      { who: "bot", kind: "buttons", body: reply, buttons: sendButtons(ready, language) },
    ]);
    setNiriksh({ ...niriksh, checklist: fields, checklistView: view, values, ready });
    setLocState("");
    setLocDistrict("");
  };

  async function toggleVoice() {
    if (recording) { recorderRef.current?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      mr.ondataavailable = e => chunks.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        setRecording(false);
        if (blob.size > MAX_EVIDENCE_BYTES) {
          setChat(c => [...c, { who: "bot", kind: "text", body: "That voice note is over the 10 MB evidence limit. Please send a shorter recording." }]);
          return;
        }
        const b64 = await blobToBase64(blob);
        call({
          type: "audio",
          mediaBase64: b64,
          mimeType: blob.type,
          fileName: `voice-note-${evidenceRef.current.length + 1}.webm`,
        }, "🎤 Voice note");
      };
      recorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      setChat(c => [...c, { who: "bot", kind: "text", body: "🎤 Mic not available here — try a text message instead." }]);
    }
  }

  const pickPhoto = () => { cancelRecording(); fileRef.current?.click(); };
  async function onPhotoChosen(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > MAX_EVIDENCE_BYTES) {
      setChat(c => [...c, { who: "bot", kind: "text", body: "That image is over the 10 MB evidence limit. Please choose a smaller file." }]);
      return;
    }
    const b64 = await blobToBase64(f);
    call({ type: "image", mediaBase64: b64, mimeType: f.type || "image/jpeg", fileName: f.name }, "📷 Photo");
  }

  return (
    <div className="wad">
      <style>{CSS}</style>

      <section className="wad-stage">
        <div className="wad-phone">
          <span className="wad-notch" aria-hidden="true" />
          <div className="wad-head">
            <div className="wad-avatar">नि</div>
            <div>
              <div className="wad-name">Niriksh</div>
              <div className="wad-status">{typing ? "typing…" : "online"}</div>
            </div>
          </div>
          <div className="wad-body" ref={scrollRef}>
            {chat.length === 0 && (
              <div className="wad-hint">👋 Choose a case type below, or type to report fraud, threats, or harmful content.</div>
            )}
            {chat.map((m, i) => (
              <div key={i} className={`wad-bubble ${m.who} ${m.kind === "processing" ? "processing" : ""}`}>
                <span className="wad-bubble-text">{formatWhatsAppText(m.body)}</span>
                {m.buttons && (
                  <div className="wad-bubble-btns">
                    {m.buttons.map(b => (
                      <button
                        key={b.id}
                        className={`wad-btn ${b.disabled ? "wad-btn-disabled" : ""}`}
                        disabled={Boolean(b.disabled)}
                        title={b.disabled ? "Fill in the required details above first" : undefined}
                        onClick={() => { if (!b.disabled) tapButton(b); }}
                      >
                        {b.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="wad-input">
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onPhotoChosen} />
            <button className="wad-icon" title="Add photo" onClick={pickPhoto}>📷</button>
            <button className="wad-icon" title="Share your State/district" onClick={openLocationPicker}>📍</button>
            <input
              value={recording ? "🎙️ Recording…" : input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendText(input)}
              placeholder="Message Niriksh…"
              readOnly={recording}
              className={recording ? "wad-input-recording" : ""}
            />
            <button className={`wad-icon ${recording ? "rec" : ""}`} title="Voice note" onClick={toggleVoice}>
              {recording ? "⏹️" : "🎤"}
            </button>
            <button className="wad-send" onClick={() => sendText(input)} disabled={busy || recording}>➤</button>
          </div>
        </div>

        <div className="wad-tray">
          {niriksh ? <>
            <div className="wad-tray-label">Report checklist</div>
            <div className="wad-checklist">
              <div className="wad-checklist-head"><strong>{niriksh.categoryLabel}</strong><span>{niriksh.checklistView.filter(item => item.done).length}/{niriksh.checklistView.length}</span></div>
              <div className="wad-progress"><i style={{ width: `${niriksh.checklistView.filter(item => item.done).reduce((total, item) => total + item.deltaPct, 0)}%` }}/></div>
              <div className="wad-checklist-rows">{niriksh.checklistView.map(item => <div className={item.done ? "done" : ""} key={item.key}><i>{item.done ? "✓" : "○"}</i><span>{item.label}<small>{t(item.required ? "badge_required" : "badge_optional", resolveLanguage(niriksh.language))}</small></span></div>)}</div>
            </div>
          </> : <>
            <div className="wad-tray-label">Try a case type →</div>
            {SCENARIOS.map((s, i) => (
              <button key={i} className="wad-bub" onClick={() => sendScenario(s)}>
                <span>{s.emoji}</span> {s.label}
              </button>
            ))}
          </>}
        </div>
      </section>

      {pickingLocation && (
        <div className="wad-loc-overlay" onClick={() => setPickingLocation(false)}>
          <div className="wad-loc-card" onClick={e => e.stopPropagation()}>
            <div className="wad-loc-head"><strong>Where are you reporting from?</strong><button onClick={() => setPickingLocation(false)}>✕</button></div>
            <div className="wad-loc-body">
              <label>State / UT<select value={locState} onChange={e => setLocState(e.target.value)}><option value="">Choose one</option>{STATES.map(s => <option key={s}>{s}</option>)}</select></label>
              <label>District or city <small>Optional</small><input value={locDistrict} onChange={e => setLocDistrict(e.target.value)} placeholder="e.g. Bengaluru Urban"/></label>
            </div>
            <div className="wad-loc-foot"><button className="wad-loc-confirm" disabled={!locState || !niriksh} onClick={confirmLocation}>Use this</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

const CSS = `
.wad { width:100%; --wa-green:#25d366; --wa-dark:#075e54; --wa-deep:#111b21; --wa-chat:#efeae2; --wa-outgoing:#d9fdd3; }
.wad-stage { display:flex; gap:24px; align-items:flex-start; flex-wrap:wrap; justify-content:center; }
.wad-phone{ width:min(340px, 100%); height:min(620px, 82vh); background:var(--wa-deep); border-radius:34px; padding:10px;
  box-shadow:0 24px 60px rgba(7,94,84,.18); display:flex; flex-direction:column; position:relative; }
.wad-notch{ position:absolute; top:0; left:50%; transform:translateX(-50%); width:70px; height:18px; background:var(--wa-deep); border-radius:0 0 12px 12px; }
.wad-head{ background:var(--wa-dark); color:#fff; display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:24px 24px 0 0; }
.wad-avatar{ width:34px; height:34px; border-radius:50%; background:rgba(255,255,255,.2); display:grid; place-items:center; font-weight:700; font-size:13px; }
.wad-name{ font-weight:700; font-size:14px; } .wad-status{ font-size:11px; opacity:.85; }
.wad-body{ flex:1; overflow-y:auto; padding:12px; background-color:var(--wa-chat); background-image:radial-gradient(rgba(7,94,84,.045) 1px,transparent 1px); background-size:18px 18px; }
.wad-hint{ background:#fff8d6; color:#6b5b00; font-size:12px; padding:10px 12px; border-radius:10px; text-align:center; margin:auto; max-width:220px; }
.wad-bubble{ max-width:84%; padding:8px 11px; border-radius:10px; margin:6px 0; font-size:13px; line-height:1.42; white-space:pre-wrap; overflow-wrap:anywhere; box-shadow:0 1px .5px rgba(0,0,0,.08); }
.wad-bubble-text a{ color:var(--wa-dark); text-decoration:underline; }
.wad-bubble.me{ background:var(--wa-outgoing); margin-left:auto; border-top-right-radius:3px; }
.wad-bubble.bot{ background:#fff; margin-right:auto; border-top-left-radius:3px; }
.wad-bubble.processing{ background:#f8fbff; color:#45515b; border:1px solid #dce8ef; }
.wad-bubble-btns{ display:flex; flex-direction:column; gap:6px; margin-top:8px; }
.wad-btn{ background:#fff; color:var(--wa-dark); border:1px solid #dfe9e4; padding:9px; border-radius:8px; font-weight:600; font-size:13px; }
.wad-btn-disabled{ color:#9aa2a6; cursor:not-allowed; }
.wad-input{ display:grid; grid-template-columns:auto auto minmax(0,1fr) auto 38px; align-items:center; gap:6px; padding:8px; background:#f0f2f5; border-radius:0 0 24px 24px; }
.wad-input input{ width:100%; border:none; background:#fff; border-radius:20px; padding:9px 14px; font-size:13px; }
.wad-input input:focus{ outline:none; }
.wad-input input.wad-input-recording{ color:#e63946; font-weight:600; }
.wad-icon{ border:none; background:transparent; font-size:16px; padding:4px; }
.wad-send{ border:none; background:var(--wa-green); color:#073b32; width:36px; height:36px; border-radius:50%; font-size:14px; display:grid; place-items:center; }
.wad-send:disabled{ opacity:.5; }
.wad-tray{ display:flex; flex-direction:column; gap:10px; width:min(280px, 100%); }
.wad-tray-label{ font-size:11px; color:var(--muted); font-weight:700; text-transform:uppercase; letter-spacing:.06em; }
.wad-bub{ background:#fff; border:1.5px solid var(--line); border-radius:20px; padding:11px 14px; text-align:left; font-size:13.5px; font-weight:600; color:var(--ink); cursor:pointer; box-shadow:var(--shadow); }
.wad-bub:hover{ border-color:var(--wa-green); }
.wad-checklist{ background:#fff; border:1px solid var(--line); border-radius:14px; padding:15px; box-shadow:var(--shadow); }
.wad-checklist-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
.wad-checklist-head strong{ font-size:14px; line-height:1.35; }
.wad-checklist-head>span{ flex:none; color:var(--wa-dark); background:#e8f8ef; border-radius:999px; padding:3px 7px; font-size:11px; font-weight:800; }
.wad-progress{ height:6px; overflow:hidden; background:#e6ece9; border-radius:99px; margin:12px 0 14px; }
.wad-progress i{ display:block; height:100%; max-width:100%; background:var(--wa-green); border-radius:inherit; transition:width .25s ease; }
.wad-checklist-rows{ display:grid; gap:9px; }
.wad-checklist-rows>div{ display:flex; align-items:flex-start; gap:8px; color:#68736f; font-size:12px; line-height:1.35; }
.wad-checklist-rows>div>i{ font-style:normal; color:#98a29e; font-weight:800; }
.wad-checklist-rows>div>span{ display:grid; gap:2px; }
.wad-checklist-rows small{ color:#909895; font-size:9px; text-transform:uppercase; letter-spacing:.04em; }
.wad-checklist-rows>div.done{ color:var(--ink); }
.wad-checklist-rows>div.done>i{ color:var(--wa-dark); }
.wad-loc-overlay{ position:fixed; inset:0; background:rgba(15,15,15,.5); display:grid; place-items:center; z-index:60; padding:20px; }
.wad-loc-card{ width:min(380px,100%); background:#fff; border-radius:14px; overflow:hidden; box-shadow:0 24px 60px rgba(0,0,0,.3); }
.wad-loc-head{ display:flex; align-items:center; justify-content:space-between; padding:14px 16px; border-bottom:1px solid var(--line); }
.wad-loc-head button{ border:none; background:transparent; font-size:15px; cursor:pointer; color:var(--muted); }
.wad-loc-body{ padding:16px; display:grid; gap:12px; }
.wad-loc-body label{ display:block; font-size:12px; font-weight:700; color:var(--ink); }
.wad-loc-body select, .wad-loc-body input{ width:100%; margin-top:6px; padding:9px; border:1px solid var(--line); border-radius:8px; font-size:13px; }
.wad-loc-foot{ padding:12px 16px; border-top:1px solid var(--line); display:flex; justify-content:flex-end; }
.wad-loc-confirm{ background:var(--wa-dark); color:#fff; border:none; border-radius:8px; padding:9px 16px; font-weight:700; font-size:13px; }
.wad-loc-confirm:disabled{ opacity:.5; }
@media (max-width: 720px){ .wad-stage{ flex-direction:column; align-items:center; } }
`;
