import { PublicHeader } from "./PublicHeader";

export function CitizenShell({ children }: { children: React.ReactNode }) {
  return <div className="citizen-shell">
    <PublicHeader/>
    <main className="citizen-shell-main">{children}</main>
    <footer className="citizen-shell-footer"><span>For immediate danger, call <a href="tel:112">112</a></span><span>Financial cyber fraud helpline: <a href="tel:1930">1930</a></span><span>Niriksh · Human-reviewed support</span></footer>
  </div>;
}
