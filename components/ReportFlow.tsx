"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  Headphones,
  Image as ImageIcon,
  Info,
  Landmark,
  Link2,
  LoaderCircle,
  LockKeyhole,
  MessageSquareText,
  Mic,
  Paperclip,
  PhoneCall,
  Play,
  Route,
  ShieldCheck,
  Sparkles,
  Square,
  UploadCloud,
  UserSearch,
  Video,
  WandSparkles,
  X,
} from "lucide-react";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { analyzeComplaint } from "@/lib/analyzer";
import { addLocalEngine, mergeMultimodalAnalysis } from "@/lib/multimodal";
import { prepareFile } from "@/lib/evidence";
import { DEMO_CHAT_DESCRIPTION } from "@/lib/mock-data";
import { AnalysisResult, ComplaintDetails, EvidenceItem, MultimodalInsight, TriageCase } from "@/lib/types";
import { useCaseStore } from "@/lib/case-store";
import { REVIEW_CATEGORIES } from "@/lib/review-policy";
import { Logo } from "./Logo";
import { PublicHeader } from "./PublicHeader";

type Screen = "intake" | "analyzing" | "analysis" | "report" | "routing";

interface VoiceRecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}

interface VoiceRecognitionEvent {
  resultIndex: number;
  results: ArrayLike<VoiceRecognitionResult>;
}

interface VoiceRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: VoiceRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
}

type VoiceRecognitionConstructor = new () => VoiceRecognition;

const CHANNELS = ["Instagram", "Facebook", "WhatsApp", "Telegram", "YouTube", "X / Twitter", "Email", "SMS", "Phone call", "Website", "Other"];
const STATES = ["Assam", "Delhi", "Karnataka", "Maharashtra", "Rajasthan", "Tamil Nadu", "Uttar Pradesh", "West Bengal", "Other / not listed"];
const HARMFUL_NATURE = ["Sexual or intimate", "Humiliating or defamatory", "Threatening or coercive", "Fraud or scam", "Harassment or bullying"];

const EMPTY_DETAILS: ComplaintDetails = {
  selectedCategory: "",
  incidentStatus: "Not sure",
  reporterRole: "Person affected",
  financial: { involved: false, moneyStatus: "Not sure" },
  aiMisuse: { suspected: false, identityUsed: "Not sure", permission: "Not sure", harmfulNature: [], distribution: "Not sure", takedownWanted: false },
  suspect: {},
  declarationConfirmed: false,
};

const DEMO_EVIDENCE: EvidenceItem = {
  name: "fictional-threatening-chat.png",
  type: "Image",
  size: "1.0 MB",
  verified: true,
  demo: true,
  mimeType: "image/png",
  previewUrl: "/demo-evidence/fictional-threatening-chat-generated.png",
  sha256: "7054a6e09167104adb67edf3ef30e911c6aa2893f0a372b49514040d0cf150dd",
  originality: "Demo",
  contextNote: "The unknown account repeatedly contacts and threatens the person reporting this.",
  extractedText: "Yesterday. You cannot keep ignoring me. Stop contacting me. I know where you work. You will regret blocking this account. Do not contact me again.",
};

const DEMO_EVIDENCE_SET: EvidenceItem[] = [
  DEMO_EVIDENCE,
  {
    name: "caller-audio-demo.webm",
    type: "Audio",
    size: "2.8 MB",
    verified: true,
    demo: true,
    mimeType: "audio/webm",
    sha256: "demo-audio-2f1b",
    originality: "Demo",
    purpose: "Supporting evidence",
    contextNote: "A short fictional call recording supplied to test audio context handling.",
    extractedText: "Yesterday evening, the caller used my brother's name and demanded an urgent payment. I did not send money.",
  },
  {
    name: "payment-receipt-demo.pdf",
    type: "Document",
    size: "184 KB",
    verified: true,
    demo: true,
    mimeType: "application/pdf",
    sha256: "demo-receipt-7c42",
    originality: "Demo",
    purpose: "Supporting evidence",
    contextNote: "A fictional receipt included to test payment-amount and date extraction.",
    extractedText: "Transaction date: yesterday. Amount: ₹8,500. Payment reference: DEMO-8500.",
  },
  {
    name: "forwarded-message-demo.txt",
    type: "Document",
    size: "2 KB",
    verified: true,
    demo: true,
    mimeType: "text/plain",
    sha256: "demo-message-91aa",
    originality: "Demo",
    purpose: "Pasted message",
    contextNote: "A fictional forwarded message used to test source and uncertainty handling.",
    extractedText: "Last night, the sender said they would publish my private photos unless I paid. I cannot confirm who controls the account.",
  },
];

const IDENTITY_THEFT_EVIDENCE: EvidenceItem[] = [
  {
    name: "ai-investment-post-monitor.png", type: "Image", size: "628 KB", verified: true, demo: true, mimeType: "image/png", sha256: "demo-identity-monitor", originality: "Demo", purpose: "Supporting evidence",
    previewUrl: "/demo-evidence/identity-theft/ai-investment-post-monitor.png",
    contextNote: "A social-media post appears to use a person's likeness to promote guaranteed investment returns.",
    extractedText: "AI-generated media detected. 10X returns guaranteed. Send UPI to secure entry. 2,500 views in 1 hour.",
  },
  {
    name: "ai-investment-post-phone.png", type: "Image", size: "566 KB", verified: true, demo: true, mimeType: "image/png", sha256: "demo-identity-phone", originality: "Demo", purpose: "Supporting evidence",
    previewUrl: "/demo-evidence/identity-theft/ai-investment-post-phone.png",
    contextNote: "A second view preserves how the alleged impersonation post appeared on a phone.",
    extractedText: "10X returns guaranteed. Send UPI to secure entry. Official Investment Launch.",
  },
  {
    name: "payment-confirmation-25000.png", type: "Image", size: "684 KB", verified: true, demo: true, mimeType: "image/png", sha256: "demo-identity-payment", originality: "Demo", purpose: "Supporting evidence",
    previewUrl: "/demo-evidence/identity-theft/payment-confirmation-25000.png",
    contextNote: "A payment confirmation is included to connect the alleged impersonation campaign with financial loss.",
    extractedText: "Transaction successful. Amount ₹25,000.00. Reference: Investment_Scheme_Fund. Transaction date 2026-08-27.",
  },
];

const FINANCIAL_FRAUD_EVIDENCE: EvidenceItem[] = [
  {
    name: "kyc-phishing-message.png", type: "Image", size: "629 KB", verified: true, demo: true, mimeType: "image/png", sha256: "demo-finance-message", originality: "Demo", purpose: "Supporting evidence",
    previewUrl: "/demo-evidence/financial-fraud/kyc-phishing-message.png",
    contextNote: "An urgent KYC message asks the recipient to open a shortened verification link.",
    extractedText: "IMPORTANT: Your bank account KYC requires immediate update to avoid suspension. Please click here to verify.",
  },
  {
    name: "debit-transaction-12600.png", type: "Image", size: "761 KB", verified: true, demo: true, mimeType: "image/png", sha256: "demo-finance-debit", originality: "Demo", purpose: "Supporting evidence",
    previewUrl: "/demo-evidence/financial-fraud/debit-transaction-12600.png",
    contextNote: "The account view shows a reported online transfer debit after the KYC message.",
    extractedText: "Transactional history. Debit online transfer. ₹12,600.",
  },
  {
    name: "kyc-message-and-receipt.png", type: "Image", size: "1.4 MB", verified: true, demo: true, mimeType: "image/png", sha256: "demo-finance-receipt", originality: "Demo", purpose: "Supporting evidence",
    previewUrl: "/demo-evidence/financial-fraud/kyc-message-and-receipt.png",
    contextNote: "A wider image places the suspicious KYC link and ₹12,600 debit receipt together.",
    extractedText: "URGENT: Your KYC is pending. Complete verification immediately. Transaction type debit withdrawal. Amount INR 12,600.00.",
  },
];

const DEMO_SCENARIOS: Array<{ label: string; description: string; details: ComplaintDetails; evidence: EvidenceItem[] }> = [
  {
    label: "Threatening messages",
    description: DEMO_CHAT_DESCRIPTION,
    details: { ...EMPTY_DETAILS, selectedCategory: "Online threats, stalking or harassment", incidentDate: "2026-08-26", incidentTime: "22:15", state: "Delhi", district: "New Delhi", policeStation: "Cyber Police Station", channel: "Telegram", accountOrUrl: "@unknown_night_sender", incidentStatus: "Still available or happening", declarationConfirmed: true },
    evidence: DEMO_EVIDENCE_SET,
  },
  {
    label: "Investment deepfake",
    description: "Someone created a fake AI video using my face to promote an investment scheme on Instagram. The post is still live, asks people to send money, and a colleague lost ₹25,000.",
    details: { ...EMPTY_DETAILS, selectedCategory: "AI-generated harmful or deceptive content", incidentDate: "2026-08-25", incidentTime: "18:30", state: "Maharashtra", district: "Mumbai", channel: "Instagram", accountOrUrl: "https://instagram.com/reel/demo184", incidentStatus: "Still available or happening", declarationConfirmed: true, aiMisuse: { suspected: true, mediaType: "Video", identityUsed: "My identity", permission: "No permission", harmfulNature: ["Fraud or scam"], distribution: "Still online or spreading", takedownWanted: true }, financial: { involved: true, amount: "25000", moneyStatus: "Transferred or debited" } },
    evidence: IDENTITY_THEFT_EVIDENCE,
  },
  {
    label: "Phishing and payment loss",
    description: "I received a bank KYC message and entered my details on a lookalike website. ₹12,600 was debited yesterday. I saved the message and payment receipt.",
    details: { ...EMPTY_DETAILS, selectedCategory: "Financial fraud or phishing", incidentDate: "2026-08-24", incidentTime: "11:10", state: "Karnataka", district: "Bengaluru", channel: "SMS", accountOrUrl: "https://secure-kyc-demo.example", incidentStatus: "Stopped or removed", declarationConfirmed: true, financial: { involved: true, bankOrWallet: "Demo Bank", transactionId: "DEMO-12600", transactionDate: "2026-08-24", amount: "12600", moneyStatus: "Transferred or debited" } },
    evidence: FINANCIAL_FRAUD_EVIDENCE,
  },
  {
    label: "Synthetic child-safety risk",
    description: "A fake explicit image using my 15-year-old daughter's face is circulating in a school WhatsApp group. We did not consent and it is still being shared.",
    details: { ...EMPTY_DETAILS, selectedCategory: "AI-generated harmful or deceptive content", incidentDate: "2026-08-26", incidentTime: "09:15", state: "Maharashtra", district: "Pune", channel: "WhatsApp", accountOrUrl: "School group (unknown sender)", incidentStatus: "Still available or happening", reporterRole: "Parent or guardian", declarationConfirmed: true, aiMisuse: { suspected: true, mediaType: "Image", identityUsed: "A child’s identity", permission: "No permission", harmfulNature: ["Sexual or intimate"], distribution: "Still online or spreading", takedownWanted: true } },
    evidence: [DEMO_EVIDENCE],
  },
];

export function ReportFlow() {
  const { addCase } = useCaseStore();
  const [screen, setScreen] = useState<Screen>("intake");
  const [description, setDescription] = useState("");
  const [details, setDetails] = useState<ComplaintDetails>(EMPTY_DETAILS);
  const [files, setFiles] = useState<EvidenceItem[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [summary, setSummary] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [reference, setReference] = useState("");
  const [copied, setCopied] = useState(false);
  const [takedownCopied, setTakedownCopied] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [sourceFiles, setSourceFiles] = useState<Record<string, File>>({});
  const [aiConfigured, setAiConfigured] = useState(false);
  const [analysisNotice, setAnalysisNotice] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [voiceInterim, setVoiceInterim] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const [previewFile, setPreviewFile] = useState<EvidenceItem | null>(null);
  const [demoScenarioIndex, setDemoScenarioIndex] = useState(0);
  const [pastedEvidence, setPastedEvidence] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceRecognitionRef = useRef<VoiceRecognition | null>(null);
  const voiceBaseTextRef = useRef("");
  const voiceFinalTextRef = useRef("");

  useEffect(() => {
    fetch("/api/analyze")
      .then(response => response.json())
      .then((status: { configured?: boolean }) => setAiConfigured(Boolean(status.configured)))
      .catch(() => setAiConfigured(false));
  }, []);

  useEffect(() => () => {
    voiceRecognitionRef.current?.stop();
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    voiceStreamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  const showAi = Boolean(details.aiMisuse?.suspected);
  const showFinancial = Boolean(details.financial?.involved);
  const hasVoiceDescription = files.some(file => file.purpose === "Voice description");
  const descriptionReady = description.trim().length >= 60 || Boolean(hasVoiceDescription && aiConfigured);
  const canAnalyse = descriptionReady && Boolean(details.selectedCategory) && Boolean(details.incidentDate) && Boolean(details.state) && Boolean(details.channel) && Boolean(details.declarationConfirmed) && !isRecording;

  const setField = <K extends keyof ComplaintDetails>(key: K, value: ComplaintDetails[K]) => setDetails(current => ({ ...current, [key]: value }));
  const setFinancial = (patch: Partial<NonNullable<ComplaintDetails["financial"]>>) => setDetails(current => ({ ...current, financial: { involved: false, ...current.financial, ...patch } }));
  const setAi = (patch: Partial<NonNullable<ComplaintDetails["aiMisuse"]>>) => setDetails(current => ({ ...current, aiMisuse: { suspected: false, ...current.aiMisuse, ...patch } }));
  const setSuspect = (patch: Partial<NonNullable<ComplaintDetails["suspect"]>>) => setDetails(current => ({ ...current, suspect: { ...current.suspect, ...patch } }));

  const toggleHarm = (item: string) => {
    const current = details.aiMisuse?.harmfulNature || [];
    setAi({ harmfulNature: current.includes(item) ? current.filter(value => value !== item) : [...current, item] });
  };

  const loadDemo = async (scenarioIndex = demoScenarioIndex) => {
    const scenario = DEMO_SCENARIOS[scenarioIndex] || DEMO_SCENARIOS[0];
    files.forEach(file => {
      if (file.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(file.previewUrl);
    });
    setDescription(scenario.description);
    setFiles(scenario.evidence.map(file => ({ ...file })));
    setSourceFiles({});
    const demoSources: Record<string, File> = {};
    await Promise.all(scenario.evidence.map(async file => {
      if (!file.previewUrl || !file.sha256) return;
      try {
        const response = await fetch(file.previewUrl);
        if (!response.ok) return;
        const blob = await response.blob();
        demoSources[file.sha256] = new File([blob], file.name, { type: file.mimeType || blob.type || "application/octet-stream" });
      } catch {
        // The text context remains available if the demo asset cannot be fetched.
      }
    }));
    setSourceFiles(demoSources);
    setDetails({ ...scenario.details });
  };

  const selectFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(event.target.files || []);
    const accepted = chosen.filter(file => file.size <= 10_000_000);
    setUploadError(accepted.length !== chosen.length ? "Files larger than 10 MB were not added." : "");
    const selected = await Promise.all(accepted.map(prepareFile));
    setFiles(current => [...current, ...selected].slice(0, 6));
    setSourceFiles(current => {
      const next = { ...current };
      selected.forEach((item, index) => { if (item.sha256) next[item.sha256] = accepted[index]; });
      return next;
    });
    event.target.value = "";
  };

  const updateFile = (index: number, patch: Partial<EvidenceItem>) => setFiles(current => current.map((file, itemIndex) => itemIndex === index ? { ...file, ...patch } : file));
  const removeFile = (index: number) => setFiles(current => {
    const removed = current[index];
    if (removed?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(removed.previewUrl);
    if (removed?.sha256) setSourceFiles(existing => {
      const next = { ...existing };
      delete next[removed.sha256!];
      return next;
    });
    return current.filter((_, itemIndex) => itemIndex !== index);
  });

  const startVoiceDescription = async () => {
    setVoiceError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("Voice recording is not supported in this browser.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;
      const preferredType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find(type => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, preferredType ? { mimeType: preferredType } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = async () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const extension = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "m4a" : "webm";
        const recording = new File([new Blob(chunks, { type: mimeType })], `voice-description-${Date.now()}.${extension}`, { type: mimeType });
        const item = await prepareFile(recording);
        item.purpose = "Voice description";
        item.contextNote = "Spoken incident description supplied by the reporter.";
        item.originality = "Original";
        setFiles(current => [...current, item].slice(0, 6));
        if (item.sha256) setSourceFiles(current => ({ ...current, [item.sha256!]: recording }));
        stream.getTracks().forEach(track => track.stop());
        voiceStreamRef.current = null;
        mediaRecorderRef.current = null;
      };
      mediaRecorderRef.current = recorder;
      voiceBaseTextRef.current = description.trim();
      voiceFinalTextRef.current = "";

      const voiceWindow = window as typeof window & { SpeechRecognition?: VoiceRecognitionConstructor; webkitSpeechRecognition?: VoiceRecognitionConstructor };
      const Recognition = voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition;
      if (Recognition) {
        const recognition = new Recognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-IN";
        recognition.onresult = event => {
          let interim = "";
          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const result = event.results[index];
            if (result.isFinal) voiceFinalTextRef.current += `${result[0].transcript.trim()} `;
            else interim += result[0].transcript;
          }
          setVoiceInterim(interim);
          setDescription([voiceBaseTextRef.current, voiceFinalTextRef.current.trim(), interim.trim()].filter(Boolean).join(" "));
        };
        recognition.onerror = event => {
          if (!['no-speech', 'aborted'].includes(event.error)) setVoiceError("Live transcription stopped, but the audio recording will still be attached.");
        };
        recognition.start();
        voiceRecognitionRef.current = recognition;
      } else {
        setVoiceError(aiConfigured ? "Live browser transcription is unavailable. The attached recording can still be reviewed by the analysis pipeline." : "Live transcription is unavailable in this browser. The recording will be attached; please add a short typed summary.");
      }
      recorder.start(250);
      setIsRecording(true);
    } catch (error) {
      voiceStreamRef.current?.getTracks().forEach(track => track.stop());
      setVoiceError(error instanceof Error ? error.message : "Microphone access could not be started.");
    }
  };

  const stopVoiceDescription = () => {
    voiceRecognitionRef.current?.stop();
    voiceRecognitionRef.current = null;
    setVoiceInterim("");
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  const addPastedEvidence = async () => {
    const text = pastedEvidence.trim();
    if (!text) return;
    const messageFile = new File([text], `pasted-message-${Date.now()}.txt`, { type: "text/plain" });
    const item = await prepareFile(messageFile);
    item.purpose = "Pasted message";
    item.contextNote = "Chat or message text pasted by the reporter.";
    item.originality = "Unknown";
    setFiles(current => [...current, item].slice(0, 6));
    if (item.sha256) setSourceFiles(current => ({ ...current, [item.sha256!]: messageFile }));
    setPastedEvidence("");
  };

  const runAnalysis = async () => {
    if (!canAnalyse) return;
    setScreen("analyzing");
    setAnalysisNotice("");
    const local = analyzeComplaint(description, files, details);
    let result = addLocalEngine(local, files.length, aiConfigured ? "The connected analysis pipeline could not be completed, so the local analyser was used automatically." : "Connected analysis is unavailable. Uploaded media was not interpreted automatically.");

    if (aiConfigured) {
      try {
        const form = new FormData();
        form.append("description", description);
        form.append("details", JSON.stringify(details));
        form.append("manifest", JSON.stringify(files.map(file => ({ name: file.name, type: file.type, size: file.size, purpose: file.purpose, contextNote: file.contextNote, originality: file.originality, extractedText: file.extractedText }))));
        for (const item of files) {
          const source = item.sha256 ? sourceFiles[item.sha256] : undefined;
          if (!source) continue;
          form.append("evidence", source, source.name);
        }
        const response = await fetch("/api/analyze", { method: "POST", body: form });
        const payload = await response.json() as { insight?: MultimodalInsight; error?: string };
        if (!response.ok || !payload.insight) throw new Error(payload.error || "Multimodal analysis was unavailable");
        result = mergeMultimodalAnalysis(local, payload.insight);
      } catch (error) {
        const message = (error instanceof Error ? error.message : "Multimodal analysis was unavailable").replace(/[.\s]+$/, "");
        setAnalysisNotice(`${message}. The structured local analysis is shown instead.`);
      }
    }

    setAnalysis(result);
    setSummary(result.summary);
    setScreen("analysis");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const createReport = async () => {
    if (!analysis) return;
    const addedContext = analysis.questions.map((question, index) => answers[index]?.trim() ? `${question} ${answers[index].trim()}` : "").filter(Boolean).join(". ");
    const refreshedLocal = addedContext ? analyzeComplaint(`${description}. Additional information: ${addedContext}`, files, details) : analysis;
    const finalAnalysis = addedContext
      ? analysis.multimodal ? mergeMultimodalAnalysis(refreshedLocal, analysis.multimodal) : addLocalEngine(refreshedLocal, files.length, analysis.engine?.limitations[0])
      : analysis;
    const finalSummary = summary === analysis.summary ? finalAnalysis.summary : summary;
    const now = Date.now();
    const nextReference = `CYB-2026-${String(185 + (now % 700)).padStart(6, "0")}`;
    const newCase: TriageCase = {
      id: `submitted-${now}`,
      reference: nextReference,
      description,
      summary: finalSummary,
      reviewCategory: details.selectedCategory,
      category: finalAnalysis.category,
      secondary: finalAnalysis.secondary,
      severity: finalAnalysis.severity,
      severityScore: finalAnalysis.score,
      status: "Awaiting review",
      completeness: finalAnalysis.completeness,
      aiSuspected: finalAnalysis.aiSuspected,
      createdAt: new Date().toISOString(),
      createdLabel: "Just now",
      platform: details.channel,
      location: [details.district, details.state].filter(Boolean).join(", "),
      department: finalAnalysis.departments,
      entities: finalAnalysis.entities,
      evidence: files,
      missing: finalAnalysis.missing,
      riskFactors: finalAnalysis.riskFactors,
      confidence: finalAnalysis.confidence,
      analysisDetails: finalAnalysis,
      complaintDetails: details,
      citizenVerification: {
        status: "Confirmed",
        summaryConfirmed: true,
        confirmedEntities: finalAnalysis.entities.length,
        totalEntities: finalAnalysis.entities.length,
        confirmedAt: "Just now",
      },
      audit: [
        { label: "Complaint details confirmed", detail: "The reporter completed the declaration and reviewed the analysis.", time: "Just now", actor: "Complainant" },
        { label: "Structured intake completed", detail: "Context, sources, missing details and a human-selected subject folder were prepared without automated priority scoring.", time: "Just now", actor: "Niriksh Analysis" },
      ],
    };
    const persistedCase = await addCase(newCase);
    if (persistedCase._uploadToken) {
      await Promise.allSettled(files.map(async item => {
        const source = item.sha256 ? sourceFiles[item.sha256] : undefined;
        if (!source) return;
        const form = new FormData();
        form.append("evidence", source, source.name);
        form.append("evidence_type", item.type);
        if (item.purpose) form.append("purpose", item.purpose);
        if (item.originality) form.append("originality", item.originality);
        if (item.contextNote) form.append("context_note", item.contextNote);
        if (item.sha256?.match(/^[a-f0-9]{64}$/i)) form.append("expected_sha256", item.sha256);
        await fetch(`/api/cases/${encodeURIComponent(persistedCase.id)}/evidence`, {
          method: "POST",
          headers: { "X-Complaint-Token": persistedCase._uploadToken! },
          body: form,
        });
      }));
    }
    setAnalysis(finalAnalysis);
    setSummary(finalSummary);
    setReference(persistedCase.reference);
    setScreen("report");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reportText = () => {
    if (!analysis) return "";
    return [
      "NIRIKSH — STRUCTURED CYBERCRIME COMPLAINT REPORT",
      `Reference: ${reference}`,
      `Created: ${new Date().toLocaleString()}`,
      "",
      `Summary: ${summary}`,
      `Human-selected subject folder: ${analysis.category}`,
      "Automated priority: Not used",
      `Verification readiness: ${analysis.verification.readiness}%`,
      `Jurisdiction supplied: ${analysis.routing.jurisdiction}`,
      "",
      "CONTEXT",
      `Reporter: ${analysis.context.reporterRole}`,
      `Current situation: ${analysis.context.incidentStatus}`,
      `Possible harm: ${analysis.context.harm.join(", ") || "Not clear"}`,
      "",
      "IMPORTANT INDICATORS",
      ...analysis.highlights.map(item => `- [${item.level}] ${item.label}: ${item.detail} (Source: ${item.source})`),
      "",
      "EVIDENCE",
      ...analysis.evidenceAnalysis.map(item => `- ${item.fileName}: ${[...item.observations, ...item.limitations].join("; ")}`),
      "",
      "HUMAN ROUTING RECORD",
      `Proposed team: ${analysis.routing.primaryUnit}`,
      ...analysis.routing.reasons.map(item => `- ${item}`),
      "",
      analysis.verification.disclaimer,
      "Routing and takedown actions require human confirmation.",
    ].join("\n");
  };

  const downloadReport = () => {
    const url = URL.createObjectURL(new Blob([reportText()], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${reference || "niriksh"}-analysis-report.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const copyReference = async () => {
    await navigator.clipboard?.writeText(reference);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const copyTakedown = async () => {
    if (!analysis) return;
    const text = [
      "Request for platform content review",
      `Reference: ${reference}`,
      `Content URL/account: ${details.aiMisuse?.contentUrl || details.accountOrUrl || "Add URL before sending"}`,
      `Reported issue: ${analysis.category}`,
      `Context: ${summary}`,
      "The content is reported as potentially manipulated, non-consensual or harmful. Please review it under the platform's applicable impersonation, manipulated-media and safety policies, and preserve relevant records.",
      "This request does not claim that authenticity has been forensically established.",
    ].join("\n");
    await navigator.clipboard?.writeText(text);
    setTakedownCopied(true);
    window.setTimeout(() => setTakedownCopied(false), 1800);
  };

  const reset = () => {
    files.forEach(file => {
      if (file.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(file.previewUrl);
    });
    setScreen("intake");
    setDescription("");
    setDetails(EMPTY_DETAILS);
    setFiles([]);
    setSourceFiles({});
    setAnalysis(null);
    setPastedEvidence("");
    setVoiceError("");
    setVoiceInterim("");
    setAnswers({});
    setReference("");
  };

  return (
    <div className="citizen-portal">
      <PublicHeader/>

      <main className="citizen-main guided-citizen-main">
        {screen === "intake" && <div className="intake-form-only">
          <section className="portal-card guided-form compact-complaint-form">
            <div className="guided-form-hero">
              <span><FileText size={22}/></span>
              <div><small>ABOUT 3 MINUTES</small><h1>Tell us what happened</h1><p>Start with the facts you remember. You do not need legal words or a perfectly written statement.</p></div>
              <div className="demo-controls"><label><span className="sr-only">Demo scenario</span><select value={demoScenarioIndex} onChange={event => setDemoScenarioIndex(Number(event.target.value))}>{DEMO_SCENARIOS.map((scenario, index) => <option value={index} key={scenario.label}>{scenario.label}</option>)}</select></label><button type="button" className="form-demo-button" onClick={() => loadDemo()}><Play size={15} fill="currentColor"/> Load demo</button></div>
            </div>
            <div className="compact-form-body">
              <label className="guided-description"><div className="voice-description-heading"><span>1. Describe the incident <em>Required</em></span><button type="button" className={isRecording ? "recording" : ""} onClick={isRecording ? stopVoiceDescription : startVoiceDescription} aria-pressed={isRecording}>{isRecording ? <><Square size={14} fill="currentColor"/> Stop recording</> : <><Mic size={17}/> Describe by voice</>}</button></div><textarea maxLength={3000} value={description} disabled={isRecording} onChange={event => setDescription(event.target.value)} placeholder="Type here, or choose ‘Describe by voice’. For example: Someone made a fake video using my face, posted it on Instagram yesterday, and is asking people for money."/><div className="description-status"><small className={descriptionReady ? "ready" : ""}>{descriptionReady ? "Description ready" : `${Math.max(0, 60 - description.length)} more typed characters recommended`} · {description.length}/3000</small>{isRecording && <span className="voice-live"><i/>Listening… {voiceInterim}</span>}{hasVoiceDescription && !isRecording && <span className="voice-added"><CheckCircle2 size={14}/>Voice recording attached</span>}</div>{voiceError && <p className="voice-error"><Info size={15}/>{voiceError}</p>}</label>

              <div className="compact-section-label"><span>2</span><div><strong>Add the basic details</strong><small>Select a subject folder and add the facts that help a person review the report.</small></div></div>
              <div className="compact-core-fields guided-field-grid">
                <label className="wide"><span>Subject folder <em>Required</em></span><select value={details.selectedCategory || ""} onChange={event => setField("selectedCategory", event.target.value)}><option value="">Choose the closest subject</option>{REVIEW_CATEGORIES.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}</select><small>The reporter chooses this folder. An officer can correct it later.</small></label>
                <label><span>Date <em>Required</em></span><input type="date" value={details.incidentDate || ""} onChange={event => setField("incidentDate", event.target.value)}/></label>
                <label><span>App or channel <em>Required</em></span><select value={details.channel || ""} onChange={event => setField("channel", event.target.value)}><option value="">Choose one</option>{CHANNELS.map(item => <option key={item}>{item}</option>)}</select></label>
                <label><span>Your State / UT <em>Required</em></span><select value={details.state || ""} onChange={event => setField("state", event.target.value)}><option value="">Choose one</option>{STATES.map(item => <option key={item}>{item}</option>)}</select></label>
                <label><span>Is it still happening?</span><select value={details.incidentStatus} onChange={event => setField("incidentStatus", event.target.value as ComplaintDetails["incidentStatus"])}><option>Still available or happening</option><option>Stopped or removed</option><option>Not sure</option></select></label>
                <label className="wide"><span>Useful account or link <small>Optional</small></span><input value={details.accountOrUrl || ""} onChange={event => setField("accountOrUrl", event.target.value)} placeholder="Username, phone, email or link to the content"/></label>
              </div>

              <div className="compact-evidence-block">
                <div><Paperclip size={18}/><span><strong>3. Add evidence</strong><small>Images, screenshots, video, audio, PDFs and text are supported</small></span></div>
                <label className="portal-dropzone compact-dropzone"><input type="file" multiple onChange={selectFiles} accept=".jpg,.jpeg,.png,.webp,.heic,.mp4,.mov,.webm,.mp3,.wav,.m4a,.aac,.ogg,.pdf,.txt,.csv,.json,.html"/><span><UploadCloud size={20}/></span><div><strong>Choose evidence files</strong><small>Up to 6 · 10 MB each</small></div></label>
                <details className="paste-evidence"><summary><span><MessageSquareText size={17}/><b>Paste a chat, SMS or email</b></span><ArrowRight size={15}/></summary><div><label><span>Paste the message exactly as received</span><textarea value={pastedEvidence} onChange={event => setPastedEvidence(event.target.value)} placeholder="Paste chat messages, an SMS, email text or a social media caption…"/></label><button type="button" onClick={addPastedEvidence} disabled={!pastedEvidence.trim()}><Paperclip size={15}/> Add as text evidence</button></div></details>
                {uploadError && <div className="upload-error"><AlertTriangle size={14}/>{uploadError}</div>}
                {files.length > 0 && <div className="portal-file-list">{files.map((file, index) => <EvidenceRow file={file} key={`${file.name}-${index}`} onPreview={setPreviewFile} onRemove={() => removeFile(index)} onChange={patch => updateFile(index, patch)}/>)}</div>}
              </div>

              <div className="quick-detail-picker"><span>Anything important to add?</span><div><button className={showAi ? "active" : ""} onClick={() => setAi({ suspected: !showAi })}><WandSparkles size={15}/> Synthetic or manipulated media</button><button className={showFinancial ? "active" : ""} onClick={() => setFinancial({ involved: !showFinancial })}><Landmark size={15}/> Money or payment</button></div></div>

              {showAi && <section className="quick-context-panel conditional-active"><div className="quick-panel-head"><WandSparkles size={18}/><span><strong>Synthetic or manipulated content</strong><small>Add only what you know</small></span><button onClick={() => setAi({ suspected: false })}><X size={15}/></button></div><div className="conditional-fields">
                <div className="guided-field-grid two">
                  <label><span>Type of content</span><select value={details.aiMisuse?.mediaType || ""} onChange={event => setAi({ mediaType: event.target.value as NonNullable<ComplaintDetails["aiMisuse"]>["mediaType"] })}><option value="">Select type</option><option>Image</option><option>Video</option><option>Audio / voice</option><option>Text / profile</option><option>Not sure</option></select></label>
                  <label><span>Whose identity is used?</span><select value={details.aiMisuse?.identityUsed || "Not sure"} onChange={event => setAi({ identityUsed: event.target.value as NonNullable<ComplaintDetails["aiMisuse"]>["identityUsed"] })}><option>My identity</option><option>A child’s identity</option><option>Someone else’s identity</option><option>No identity used</option><option>Not sure</option></select></label>
                  <label><span>Was permission given?</span><select value={details.aiMisuse?.permission || "Not sure"} onChange={event => setAi({ permission: event.target.value as NonNullable<ComplaintDetails["aiMisuse"]>["permission"] })}><option>No permission</option><option>Permission was given</option><option>Not sure</option></select></label>
                  <label><span>Is it still online or spreading?</span><select value={details.aiMisuse?.distribution || "Not sure"} onChange={event => setAi({ distribution: event.target.value as NonNullable<ComplaintDetails["aiMisuse"]>["distribution"] })}><option>Still online or spreading</option><option>Removed or stopped</option><option>Not sure</option></select></label>
                  <label className="wide"><span>Direct content URL</span><input value={details.aiMisuse?.contentUrl || ""} onChange={event => setAi({ contentUrl: event.target.value })} placeholder="Link to the post, profile, video or message if available"/></label>
                </div>
                <fieldset className="harm-checks"><legend>What makes the content harmful or questionable?</legend><div>{HARMFUL_NATURE.map(item => <label key={item}><input type="checkbox" checked={details.aiMisuse?.harmfulNature?.includes(item) || false} onChange={() => toggleHarm(item)}/><span>{item}</span></label>)}</div></fieldset>
                <label className="feature-toggle compact"><input type="checkbox" checked={Boolean(details.aiMisuse?.takedownWanted)} onChange={event => setAi({ takedownWanted: event.target.checked })}/><span><strong>I want guidance for requesting platform takedown</strong><small>The system will first remind you to preserve the evidence.</small></span></label>
              </div></section>}

              {showFinancial && <section className="quick-context-panel conditional-active"><div className="quick-panel-head"><Landmark size={18}/><span><strong>Payment details</strong><small>These identifiers can speed up financial review</small></span><button onClick={() => setFinancial({ involved: false })}><X size={15}/></button></div><div className="conditional-fields guided-field-grid two">
                <label><span>Bank, wallet or merchant</span><input value={details.financial?.bankOrWallet || ""} onChange={event => setFinancial({ bankOrWallet: event.target.value })} placeholder="Name of bank, wallet or merchant"/></label>
                <label><span>Transaction ID / UTR</span><input value={details.financial?.transactionId || ""} onChange={event => setFinancial({ transactionId: event.target.value })} placeholder="Transaction reference"/></label>
                <label><span>Transaction date</span><input type="date" value={details.financial?.transactionDate || ""} onChange={event => setFinancial({ transactionDate: event.target.value })}/></label>
                <label><span>Fraud amount</span><div className="money-input"><b>₹</b><input inputMode="decimal" value={details.financial?.amount || ""} onChange={event => setFinancial({ amount: event.target.value.replace(/[^\d,.]/g, "") })} placeholder="0.00"/></div></label>
                <label className="wide"><span>What happened to the money?</span><select value={details.financial?.moneyStatus || "Not sure"} onChange={event => setFinancial({ moneyStatus: event.target.value as NonNullable<ComplaintDetails["financial"]>["moneyStatus"] })}><option>Transferred or debited</option><option>Payment attempted or stopped</option><option>No money sent</option><option>Not sure</option></select></label>
              </div></section>}

              <details className="compact-more-details"><summary><span><UserSearch size={17}/><b>Add optional context</b><small>Person affected, district, time, delay or suspect details</small></span><ArrowRight size={15}/></summary><div className="compact-optional-body"><div className="guided-field-grid two"><label><span>Who is affected?</span><select value={details.reporterRole} onChange={event => setField("reporterRole", event.target.value as ComplaintDetails["reporterRole"])}><option>Person affected</option><option>Parent or guardian</option><option>Reporting for someone else</option></select></label><label><span>Approximate time</span><input type="time" value={details.incidentTime || ""} onChange={event => setField("incidentTime", event.target.value)}/></label><label><span>District</span><input value={details.district || ""} onChange={event => setField("district", event.target.value)} placeholder="If known"/></label><label><span>Police station</span><input value={details.policeStation || ""} onChange={event => setField("policeStation", event.target.value)} placeholder="If known"/></label><label className="wide"><span>Reason for delayed reporting</span><input value={details.delayReason || ""} onChange={event => setField("delayReason", event.target.value)} placeholder="Only if relevant"/></label></div><details className="suspect-details compact-suspect"><summary><span><UserSearch size={18}/><b>Suspect identifiers</b><small>Optional — do not guess</small></span><ArrowRight size={16}/></summary><div className="guided-field-grid two"><label><span>Name or alias</span><input value={details.suspect?.nameOrAlias || ""} onChange={event => setSuspect({ nameOrAlias: event.target.value })}/></label><label><span>Mobile number</span><input value={details.suspect?.phone || ""} onChange={event => setSuspect({ phone: event.target.value })}/></label><label><span>Email address</span><input type="email" value={details.suspect?.email || ""} onChange={event => setSuspect({ email: event.target.value })}/></label><label><span>Bank account</span><input value={details.suspect?.bankAccount || ""} onChange={event => setSuspect({ bankAccount: event.target.value })}/></label><label className="wide"><span>Profile, website or address</span><input value={details.suspect?.profileOrWebsite || ""} onChange={event => setSuspect({ profileOrWebsite: event.target.value })}/></label></div></details></div></details>
            </div>

            <label className="reporter-declaration"><input type="checkbox" checked={Boolean(details.declarationConfirmed)} onChange={event => setField("declarationConfirmed", event.target.checked)}/><span><strong>I confirm this information is accurate to the best of my knowledge.</strong><small>I understand that deliberately false information can harm another person and waste reviewer time. The analyser will organise my report but will not decide guilt.</small></span></label>

            <div className="guided-form-footer">
              <span><LockKeyhole size={15}/>{aiConfigured ? "The analysis pipeline reviews the complaint and supported evidence. Temporary processing files are deleted afterward." : "Local analysis mode. Selected files stay in this browser."}</span>
              <button className="portal-primary" onClick={runAnalysis} disabled={!canAnalyse}>Organise complaint <ArrowRight size={17}/></button>
            </div>
          </section>
        </div>}

        {screen === "analyzing" && <section className="portal-loading">
          <div className="analysis-orbit"><BrainCircuit size={32}/><i/><b/></div>
          <span>{aiConfigured ? "EVIDENCE ANALYSIS PIPELINE" : "LOCAL STRUCTURED ANALYSIS"}</span><h1>Connecting the complaint and evidence</h1><p>{aiConfigured ? "The pipeline is combining the narrative, structured details and supported media into source-backed findings." : "Reading the complaint and evidence notes with the local analysis pipeline."}</p>
          <div className="loading-checks"><span className="done"><Check/> Complaint context read</span><span className="done"><Check/> Evidence prepared</span><span><LoaderCircle className="portal-spin"/> {aiConfigured ? "Understanding context and evidence" : "Checking risk and report structure"}</span></div>
        </section>}

        {screen === "analysis" && analysis && <section className="understanding-workspace">
          <div className="results-heading"><div><span><Sparkles size={15}/> ANALYSIS PIPELINE</span><h1>Review what the system understood</h1><p>Every important indicator includes its source. Correct anything that is wrong before creating the report.</p></div><button className="portal-secondary" onClick={() => setScreen("intake")}><ArrowLeft size={15}/> Edit complaint</button></div>
          {analysisNotice && <div className="analysis-notice"><Info size={18}/><span><strong>Connected media analysis was unavailable</strong>{analysisNotice}</span></div>}
          <div className={`engine-disclosure ${analysis.engine?.mode === "Multimodal AI" ? "connected" : "local"}`}><BrainCircuit size={18}/><div><strong>{analysis.engine?.label || "Structured text analysis"}</strong><span>{analysis.engine?.mode === "Multimodal AI" ? `${analysis.engine.mediaReviewed} evidence item${analysis.engine.mediaReviewed === 1 ? " was" : "s were"} analysed alongside the complaint context. Human verification remains required.` : "The result is based on structured fields, complaint text and evidence notes; media content was not interpreted."}</span></div></div>

          <div className="analysis-decision-strip">
            <div><small>SUBJECT FOLDER</small><strong>{analysis.category}</strong><span>Selected by the reporter</span></div>
            <div><small>PROPOSED REVIEW TEAM</small><strong>{analysis.routing.primaryUnit}</strong><span>Officer confirmation required</span></div>
            <div><small>INFORMATION CHECKLIST</small><strong>{analysis.verification.readiness}%</strong><span>{analysis.verification.readyChecks}/{analysis.verification.totalChecks} details ready</span></div>
          </div>

          <article className="analysis-card summary-card"><div className="analysis-card-title"><div><ClipboardCheck size={18}/><h2>Plain-language summary</h2></div><span>Editable</span></div><textarea value={summary} onChange={event => setSummary(event.target.value)}/><p><Info size={14}/> This describes the allegation. It is not a finding that the content is fake or that a person is responsible.</p></article>

          {analysis.highlights.length > 0 && <article className="analysis-card important-highlights"><div className="analysis-card-title"><div><AlertTriangle size={18}/><h2>Important parts to review</h2></div><span>Source-backed</span></div><div>{analysis.highlights.map(item => <div className={`highlight-${item.level.toLowerCase()}`} key={item.label}><i/><span><strong>{item.label}</strong><p>{item.detail}</p><small>Source: {item.source}</small></span></div>)}</div></article>}

          <div className="analysis-two-column">
            <article className="analysis-card"><div className="analysis-card-title"><div><BrainCircuit size={18}/><h2>Context understood</h2></div></div><div className="plain-context-grid"><div><small>REPORTER</small><strong>{analysis.context.reporterRole}</strong></div><div><small>CURRENT SITUATION</small><strong>{analysis.context.incidentStatus}</strong></div><div><small>POSSIBLE HARM</small><strong>{analysis.context.harm.join(", ") || "Not clear yet"}</strong></div><div><small>ACTIONS TAKEN</small><strong>{analysis.context.actionsTaken.join(", ") || "None mentioned"}</strong></div></div></article>
            <article className="analysis-card verification-card"><div className="analysis-card-title"><div><ShieldCheck size={18}/><h2>Fast verification checklist</h2></div></div><div>{analysis.verification.checks.map(check => <span className={`check-${check.status.toLowerCase().replace(" ", "-")}`} key={check.label}>{check.status === "Ready" ? <CheckCircle2/> : <AlertTriangle/>}<b>{check.label}</b><small>{check.detail}</small></span>)}</div><p>{analysis.verification.disclaimer}</p></article>
          </div>

          <article className="analysis-card"><div className="analysis-card-title"><div><Paperclip size={18}/><h2>Evidence explanation</h2></div><span>{files.length} file{files.length === 1 ? "" : "s"}</span></div>{files.length ? <div className="plain-evidence-list">{files.map((file, index) => { const finding = analysis.evidenceAnalysis.find(item => item.fileName === file.name); return <div className="plain-evidence-item" key={`${file.name}-${index}`}><EvidencePreview file={file} onPreview={setPreviewFile}/><div><strong>{file.name}</strong><small>{finding?.status === "AI reviewed" ? "Content analysed" : finding?.status}</small>{finding?.observations.map(item => <p key={item}><CheckCircle2 size={13}/>{item}</p>)}{finding?.limitations.map(item => <p className="limitation" key={item}><Info size={13}/>{item}</p>)}</div></div>; })}</div> : <p className="lab-empty">No file is attached. Analysis is based on the form and description.</p>}</article>

          {analysis.questions.length > 0 && <article className="analysis-card"><div className="analysis-card-title"><div><Info size={18}/><h2>Information that would strengthen the report</h2></div><span>Answer if known</span></div><div className="simple-questions">{analysis.questions.map((question, index) => <label key={question}><span>{question}</span><input value={answers[index] || ""} onChange={event => setAnswers(current => ({ ...current, [index]: event.target.value }))} placeholder="Your answer"/></label>)}</div></article>}

          <div className="results-actions"><span>Review the summary and indicators before creating the formal report.</span><button className="portal-primary" onClick={createReport}>Create report <ArrowRight size={17}/></button></div>
        </section>}

        {screen === "report" && analysis && <section className="report-workspace smart-report-workspace">
          <div className="submitted-hero smart-submitted-hero"><span className="submitted-check"><Check size={28}/></span><div><small>REPORT PREPARED</small><h1>Your information is organised and ready to use</h1><p>Save the reference and report. This prototype has prepared the document, but it has not submitted it to an authority.</p></div><div className="submitted-actions"><button className="portal-secondary" onClick={downloadReport}><Download size={16}/> Download text</button><button className="portal-primary" onClick={() => window.print()}><FileText size={16}/> Save as PDF</button></div></div>

          <div className="smart-report-grid">
            <article className="citizen-report smart-report-main">
              <div className="report-document-head"><Logo/><div><span>COMPLAINT ANALYSIS</span><small>Human verification required</small></div></div>
              <div className="smart-reference-row"><div><small>KEEP THIS REFERENCE</small><strong>{reference}</strong><span>Use it when discussing this prepared report.</span></div><button onClick={copyReference}>{copied ? <Check size={17}/> : <Copy size={17}/>} {copied ? "Copied" : "Copy reference"}</button></div>

              <section className="report-at-a-glance">
                <div className="report-priority-card"><small>DECISION POLICY</small><div className="priority-label-row"><ShieldCheck size={18}/><span>Human review</span></div><p>No automated priority, guilt, or routing decision is generated.</p></div>
                <div><small>SUBJECT FOLDER</small><strong>{analysis.category}</strong><p>Selected by the reporter; officer-confirmed</p></div>
                <div><small>READY FOR REVIEW</small><strong>{analysis.verification.readiness}%</strong><p>{analysis.verification.readyChecks} of {analysis.verification.totalChecks} checks ready</p></div>
              </section>

              <section className="smart-report-summary"><span><Eye size={20}/></span><div><small>WHAT THE SYSTEM UNDERSTOOD</small><p>{summary}</p></div></section>

              <section className="smart-important-section">
                <div className="smart-section-title"><div><AlertTriangle size={20}/><span><small>SOURCE-BACKED CONTEXT</small><h2>Details mentioned in the report</h2></span></div><b>{analysis.highlights.length}</b></div>
                <div className="smart-indicator-list">{analysis.highlights.slice(0, 5).map(item => <article className={`smart-indicator ${item.level.toLowerCase()}`} key={`${item.label}-${item.source}`}><i/><div><span><strong>{item.label}</strong><em>{item.level}</em></span><p>{item.detail}</p><small>Source: {item.source}</small></div></article>)}</div>
                {!analysis.highlights.length && <p className="report-empty-copy">No context marker was extracted automatically. A human should still review the full report.</p>}
              </section>

              <section className="report-timeline-section">
                <div className="smart-section-title"><div><Route size={20}/><span><small>INCIDENT SEQUENCE</small><h2>Timeline understood</h2></span></div><b className="timeline-count">{analysis.timeline.length || 1} event{(analysis.timeline.length || 1) === 1 ? "" : "s"}</b></div>
                <div className="report-event-line">
                  {analysis.timeline.length ? analysis.timeline.slice(0, 6).map((event, index) => <div key={`${event.when}-${index}`}><i/><time>{event.when}</time><span><strong>{event.what}</strong><small>{event.precision} · {event.source}</small></span></div>) : <div><i/><time>Date supplied</time><span><strong>The incident date is recorded in the complaint.</strong><small>See full details below.</small></span></div>}
                  <div className="prepared-event"><i/><time>Now</time><span><strong>Structured report prepared</strong><small>Not submitted automatically</small></span></div>
                </div>
              </section>

              <details className="full-report-details"><summary><span><FileText size={19}/><b>View complete evidence and verification details</b></span><ArrowRight size={18}/></summary><div>
                <section><h2>Context understood</h2><div className="full-context-grid"><span><small>Reporter</small><strong>{analysis.context.reporterRole}</strong></span><span><small>Current situation</small><strong>{analysis.context.incidentStatus}</strong></span><span><small>Possible harm</small><strong>{analysis.context.harm.join(", ") || "Not clear"}</strong></span><span><small>Actions already taken</small><strong>{analysis.context.actionsTaken.join(", ") || "None mentioned"}</strong></span></div></section>
                <section><h2>Evidence explanation</h2>{analysis.evidenceAnalysis.length ? <div className="full-evidence-list">{analysis.evidenceAnalysis.map(item => <article key={item.fileName}><FileCheck2 size={18}/><div><span><strong>{item.fileName}</strong><em>{item.status === "AI reviewed" ? "Content analysed" : item.status}</em></span>{item.observations.map(observation => <p key={observation}><CheckCircle2 size={14}/>{observation}</p>)}{item.limitations.map(limitation => <p className="limitation" key={limitation}><Info size={14}/>{limitation}</p>)}</div></article>)}</div> : <p>No attachment was supplied.</p>}</section>
                <section><h2>Verification checklist</h2><div className="full-verification-list">{analysis.verification.checks.map(check => <span key={check.label} className={check.status === "Ready" ? "ready" : "missing"}>{check.status === "Ready" ? <CheckCircle2/> : <AlertTriangle/>}<div><strong>{check.label}</strong><small>{check.detail}</small></div></span>)}</div></section>
                <div className="report-verification-note"><ShieldCheck size={20}/><span><strong>What verification means</strong>{analysis.verification.disclaimer}</span></div>
              </div></details>
              <footer><span>Prepared by Niriksh · Analysis pipeline</span><span>Reporter-confirmed information · Decisions remain human</span></footer>
            </article>

            <aside className="report-assurance-column">
              <article className="report-status-card"><span><ShieldCheck size={23}/></span><small>CURRENT STATUS</small><h2>Prepared—not yet submitted</h2><p>Your report is organised for review. Use the official portal or contact shown below to file or seek urgent help.</p><button className="portal-primary" onClick={() => setScreen("routing")}>Review destination information <ArrowRight size={16}/></button><Link className="portal-secondary report-track-link" href="/track">View in my complaints</Link></article>

              <article className="what-next-card"><small>WHAT HAPPENS NEXT</small><h2>Your next steps</h2><ol><li className="done"><i><Check/></i><span><strong>Report prepared</strong><small>Save your reference and a copy.</small></span></li><li><i>2</i><span><strong>Submit through an official channel</strong><small>Niriksh has not sent it automatically.</small></span></li><li><i>3</i><span><strong>Human review and updates</strong><small>Use the official acknowledgement number to track it.</small></span></li></ol></article>

              <article className="contact-support-card"><small>PEOPLE AND SERVICES TO CONTACT</small><h2>Get further help</h2>
                <a className="urgent-contact" href="tel:112"><span><PhoneCall size={19}/></span><div><strong>Emergency operator · 112</strong><small>Call if someone is in immediate danger.</small></div></a>
                {(analysis.context.harm.includes("Financial loss") || analysis.context.harm.includes("Possible financial loss")) && <a href="tel:1930"><span><Landmark size={19}/></span><div><strong>Financial fraud helpline · 1930</strong><small>Report financial cyber fraud immediately.</small></div></a>}
                <a href="https://www.cybercrime.gov.in/" target="_blank" rel="noreferrer"><span><FileText size={19}/></span><div><strong>National Cyber Crime Portal</strong><small>File and track an official cybercrime complaint.</small></div><ExternalLink size={15}/></a>
                <a href="https://www.cybercrime.gov.in/webform/Crime_NodalGrivanceList.aspx" target="_blank" rel="noreferrer"><span><Headphones size={19}/></span><div><strong>State / UT grievance officer</strong><small>Official follow-up contacts by location.</small></div><ExternalLink size={15}/></a>
              </article>
            </aside>
          </div>
        </section>}

        {screen === "routing" && analysis && <section className="routing-workspace">
          <div className="routing-heading"><span><Route size={22}/></span><div><small>ROUTING INFORMATION</small><h1>{analysis.routing.status}</h1><p>The subject folder suggests a review team. A human must confirm and submit it.</p></div></div>
          <div className="citizen-routing-summary"><div><small>SUBJECT FOLDER</small><strong>{analysis.category}</strong></div><div><small>INFORMATION READY</small><strong>{analysis.verification.readiness}%</strong></div><div><small>EVIDENCE ITEMS</small><strong>{files.length}</strong></div><div><small>DETAILS TO ADD</small><strong>{analysis.missing.length}</strong></div></div>
          <div className="routing-grid">
            <article className="routing-primary"><small>PROPOSED SUBJECT TEAM</small><span><Landmark size={22}/></span><h2>{analysis.routing.primaryUnit}</h2><p>{analysis.routing.jurisdiction}</p><div>{analysis.routing.reasons.map(item => <span key={item}><CheckCircle2 size={14}/>{item}</span>)}</div></article>
            <article className="routing-support"><h2>Supporting review</h2>{analysis.routing.supportingUnits.length ? analysis.routing.supportingUnits.map(unit => <span key={unit}><ShieldCheck size={15}/>{unit}</span>) : <p>No additional specialist unit is currently suggested.</p>}<div className="routing-not-sent"><Info size={15}/><span><strong>Not automatically sent</strong>This prototype displays routing information only.</span></div></article>
          </div>
          <article className="routing-next-card"><div><small>WHAT TO DO NOW</small><h2>Confirm the destination and complete the official report</h2><p>Keep your evidence unchanged, have a person confirm the location and team, then submit through an official channel. This page has not sent anything automatically.</p></div><ol><li><i>1</i><span><strong>Human confirmation</strong><small>Confirm the State, district, subject folder, and review team.</small></span></li><li><i>2</i><span><strong>Save your prepared report</strong><small>Keep the reference and original evidence files.</small></span></li><li><i>3</i><span><strong>Submit and track officially</strong><small>Use the acknowledgement number supplied by the authority.</small></span></li></ol><div><a className="portal-primary" href="https://www.cybercrime.gov.in/" target="_blank" rel="noreferrer">Open official portal <ExternalLink size={15}/></a>{(analysis.context.harm.includes("Financial loss") || analysis.context.harm.includes("Possible financial loss")) && <a className="portal-secondary" href="tel:1930"><PhoneCall size={15}/> Call 1930</a>}</div></article>
          {analysis.takedown.recommended && <article className="takedown-card"><div className="takedown-icon"><Link2 size={22}/></div><div><small>CONTENT SAFETY PROMPT</small><h2>{analysis.takedown.title}</h2><div className="takedown-reasons">{analysis.takedown.reasons.map(item => <span key={item}><AlertTriangle size={13}/>{item}</span>)}</div><ol>{analysis.takedown.preservationSteps.map(step => <li key={step}>{step}</li>)}</ol></div><button onClick={copyTakedown}><Copy size={15}/>{takedownCopied ? "Copied request" : "Copy takedown request"}</button></article>}
          <div className="routing-actions"><button className="portal-secondary" onClick={() => setScreen("report")}><ArrowLeft size={15}/> Back to report</button><div><Link href="/dashboard" className="portal-secondary">Open evidence workspace</Link><button className="portal-primary" onClick={reset}>Start another complaint</button></div></div>
        </section>}
      </main>

      <footer className="citizen-footer"><span>Niriksh prototype · Evidence analysis and routing support</span><span>Privacy-first · Reporter-confirmed · Human-reviewed</span></footer>
      {previewFile && <div className="evidence-lightbox" role="dialog" aria-modal="true" aria-label={`Preview of ${previewFile.name}`} onClick={() => setPreviewFile(null)}><div className="evidence-lightbox-panel" onClick={event => event.stopPropagation()}><div><strong>{previewFile.name}</strong><button type="button" onClick={() => setPreviewFile(null)} aria-label="Close evidence preview"><X size={20}/></button></div>{previewFile.type === "Image" && previewFile.previewUrl && <Image src={previewFile.previewUrl} alt={`Full preview of ${previewFile.name}`} width={1000} height={1000} unoptimized={previewFile.previewUrl.startsWith("blob:")} />}{previewFile.type === "Video" && previewFile.previewUrl && <video src={previewFile.previewUrl} controls autoPlay />}{previewFile.type === "Audio" && previewFile.previewUrl && <audio src={previewFile.previewUrl} controls autoPlay />}{(!previewFile.previewUrl || previewFile.type === "Document") && <p>This file has no visual preview. Download or open the original file to inspect its contents.</p>}</div></div>}
    </div>
  );
}

function EvidencePreview({ file, onPreview }: { file: EvidenceItem; onPreview?: (file: EvidenceItem) => void }) {
  const className = `evidence-visual${file.type === "Audio" ? " audio-visual" : ""}${!file.previewUrl ? ` evidence-placeholder ${file.type.toLowerCase()}` : ""}`;
  const content = file.type === "Image" && file.previewUrl ? <Image src={file.previewUrl} alt={`Preview of ${file.name}`} fill unoptimized={file.previewUrl.startsWith("blob:")} sizes="160px"/> : file.type === "Video" && file.previewUrl ? <video src={file.previewUrl} muted preload="metadata" aria-label={`Video preview of ${file.name}`}/> : file.type === "Audio" && file.previewUrl ? <Headphones size={25}/> : file.type === "Video" ? <Video size={28}/> : file.type === "Image" ? <ImageIcon size={28}/> : <FileText size={28}/>;
  if (onPreview && file.previewUrl) return <button type="button" className={`${className} evidence-preview-trigger`} onClick={() => onPreview(file)} aria-label={`Open preview of ${file.name}`}>{content}</button>;
  return <div className={className}>{content}</div>;
}

function EvidenceRow({ file, onPreview, onRemove, onChange }: { file: EvidenceItem; onPreview: (file: EvidenceItem) => void; onRemove: () => void; onChange: (patch: Partial<EvidenceItem>) => void }) {
  return <div className="portal-file-item"><div className="portal-file-row"><EvidencePreview file={file} onPreview={onPreview}/><div><strong>{file.name}</strong><span>{file.purpose || file.type} · {file.size} · SHA-256 fingerprint saved</span></div><CheckCircle2 size={18}/><button onClick={onRemove} aria-label={`Remove ${file.name}`}><X size={17}/></button></div><div className="file-context-row"><input value={file.contextNote || ""} onChange={event => onChange({ contextNote: event.target.value })} placeholder="What should the reviewer notice in this file?"/><select value={file.originality || "Unknown"} onChange={event => onChange({ originality: event.target.value as EvidenceItem["originality"] })}><option value="Unknown">How was this obtained?</option><option value="Original">Original file</option><option value="Screenshot">Screenshot</option><option value="Forwarded">Forwarded to me</option><option value="Edited">Cropped or edited</option><option value="Demo">Fictional demo</option></select></div></div>;
}
