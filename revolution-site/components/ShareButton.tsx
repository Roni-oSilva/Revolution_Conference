'use client';
import { useState } from 'react';

export function ShareButton({ path, title, text }: { path: string; title: string; text: string }) {
  const [msg, setMsg] = useState('');
  const [manual, setManual] = useState('');
  async function share() {
    const url = new URL(path, window.location.origin).href;
    try {
      if (navigator.share) { await navigator.share({ title, text, url }); return; }
    } catch (e) { if ((e as Error).name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(url); setMsg('Link copiado!'); setTimeout(() => setMsg(''), 2500); }
    catch { setManual(url); }
  }
  return (
    <span className="row">
      <button type="button" className="btn small" onClick={share}>Compartilhar</button>
      <span role="status" aria-live="polite" className="muted" style={{ fontSize: 13 }}>{msg}</span>
      {manual && <input readOnly value={manual} aria-label="Link da publicação" onFocus={(e) => e.currentTarget.select()} style={{ maxWidth: 320 }} />}
    </span>
  );
}
