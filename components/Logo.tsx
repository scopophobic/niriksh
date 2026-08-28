import { ShieldCheck } from "lucide-react";

export function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className={`logo ${inverse ? "logo-inverse" : ""}`}>
      <span className="logo-mark"><ShieldCheck size={21} strokeWidth={2.4} /></span>
      <span><strong>Niriksh</strong><small>EVIDENCE INTELLIGENCE</small></span>
    </div>
  );
}
