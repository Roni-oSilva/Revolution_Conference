import { useState } from "react";

export function ShareButton({ path, title }: { path: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = `${window.location.origin}${path}`;
    if (navigator.share) { try { await navigator.share({ title, url }); return; } catch { /* cancelado */ } }
    await navigator.clipboard?.writeText(url);
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };
  return <button onClick={share} className="btn-ghost">📤 {copied ? "Link copiado!" : "Compartilhar"}</button>;
}
