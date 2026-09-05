// Evidence preparation shared by ReportFlow.tsx (the guided form) and WhatsAppDemo.tsx (the
// chat). Extracted out of ReportFlow.tsx rather than duplicated, so both surfaces hash, size
// and classify a file identically.

import { EvidenceItem } from "./types";

export function classifyFile(file: File): EvidenceItem["type"] {
  if (file.type.startsWith("video")) return "Video";
  if (file.type.startsWith("image")) return "Image";
  if (file.type.startsWith("audio")) return "Audio";
  return "Document";
}

export function fileSize(bytes: number): string {
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.ceil(bytes / 1000))} KB`;
}

export async function prepareFile(file: File): Promise<EvidenceItem> {
  const type = classifyFile(file);
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, "0")).join("");
  const lowerName = file.name.toLowerCase();
  const isText = file.type.startsWith("text/") || file.type === "application/json" || [".txt", ".csv", ".json", ".html"].some(extension => lowerName.endsWith(extension));
  return {
    name: file.name,
    type,
    size: fileSize(file.size),
    verified: true,
    mimeType: file.type,
    sha256,
    extractedText: isText ? new TextDecoder().decode(bytes).slice(0, 100_000) : undefined,
    originality: "Unknown",
    previewUrl: type === "Image" || type === "Video" || type === "Audio" ? URL.createObjectURL(file) : undefined,
    purpose: "Supporting evidence",
  };
}

export interface Base64EvidenceItem {
  base64: string;
  mimeType: string;
  name: string;
}

// Reconstructs a real File from the base64 the chat accumulated turn-by-turn — the chat holds
// evidence as base64 (for cheap inline Gemini multimodal reads on every turn), but niriksh's
// upload pipeline (prepareFile above, and ReportFlow.tsx's submit step) needs actual File
// objects it can SHA-256-hash and POST as multipart form data.
export function base64ToFile(item: Base64EvidenceItem): File {
  const binary = atob(item.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], item.name, { type: item.mimeType || "application/octet-stream" });
}
