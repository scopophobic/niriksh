"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, LifeBuoy, MessageCircle, MessageSquareWarning, Sparkles } from "lucide-react";
import { Logo } from "./Logo";
import { POVSwitch } from "./POVSwitch";

export function PublicHeader() {
  const path = usePathname();
  return <header className="public-unified-header">
    <Link className="public-brand" href="/" aria-label="Niriksh home"><Logo/></Link>
    <nav aria-label="Niriksh navigation">
      <Link className={path.startsWith("/prevention") ? "active" : ""} href="/prevention"><Sparkles/>Explore intelligence</Link>
      <Link className={path === "/whatsapp" ? "active" : ""} href="/whatsapp"><MessageCircle/>WhatsApp demo</Link>
      <Link className={path === "/safety" ? "active" : ""} href="/safety"><MessageSquareWarning/>Safety check</Link>
      <a href="tel:1930"><LifeBuoy/>Get help</a>
    </nav>
    <div className="public-header-actions"><Link className="public-header-report" href="/report">Report an incident <ArrowRight/></Link><POVSwitch current="citizen"/></div>
  </header>;
}
