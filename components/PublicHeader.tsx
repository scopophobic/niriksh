"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FilePlus2, LifeBuoy, MessageSquareWarning, SearchCheck } from "lucide-react";
import { Logo } from "./Logo";
import { POVSwitch } from "./POVSwitch";

export function PublicHeader() {
  const path = usePathname();
  return <header className="public-unified-header">
    <Link className="public-brand" href="/" aria-label="Niriksh home"><Logo/></Link>
    <nav aria-label="Citizen navigation">
      <Link className={path === "/track" ? "active" : ""} href="/track"><SearchCheck/>My complaints</Link>
      <Link className={path === "/safety" ? "active" : ""} href="/safety"><MessageSquareWarning/>Check a message</Link>
      <Link className={path === "/report" ? "active" : ""} href="/report"><FilePlus2/>Register complaint</Link>
      <a href="tel:1930"><LifeBuoy/>Get help</a>
    </nav>
    <div className="public-header-switch"><POVSwitch current="citizen"/></div>
  </header>;
}
