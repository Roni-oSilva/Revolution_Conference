'use client';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { computePhase, type Phase } from '@/lib/phase';

interface Clock { now: number; phase: Phase }
const ClockCtx = createContext<Clock>({ now: 0, phase: 'pre' });
export const useClock = () => useContext(ClockCtx);

interface Props {
  serverNow: number;           // ms, hora do servidor no momento da renderização
  opensAt: number | null;      // ms
  endsAt: number | null;       // ms
  pre: ReactNode; open: ReactNode; ended: ReactNode;
  forcePhase?: Phase;          // somente pré-visualização do admin
}

/** Troca de fase SEM recarregar: usa a hora do servidor (corrigida por /api/time), não o relógio do visitante. */
export function PhaseGate({ serverNow, opensAt, endsAt, pre, open, ended, forcePhase }: Props) {
  const [now, setNow] = useState(serverNow);
  const offset = useRef(0);
  const router = useRouter();

  useEffect(() => {
    if (forcePhase) return;
    offset.current = serverNow - Date.now();
    let stopped = false;
    const tick = () => { if (!stopped) setNow(Date.now() + offset.current); };

    async function sync() {
      try {
        const t0 = Date.now();
        const res = await fetch('/api/time', { cache: 'no-store' });
        if (!res.ok) return;
        const { now: iso } = (await res.json()) as { now: string };
        const t1 = Date.now();
        const server = Date.parse(iso);
        if (Number.isFinite(server)) { offset.current = server + (t1 - t0) / 2 - t1; tick(); }
      } catch { /* sem rede: segue com a última referência conhecida */ }
    }
    void sync();
    const id = window.setInterval(tick, 250);
    // ao voltar à aba / foco / rede: recalcula a hora E busca de novo as datas do evento (o admin pode ter mudado a abertura)
    const resync = () => { if (document.visibilityState !== 'hidden') { void sync(); router.refresh(); } };
    document.addEventListener('visibilitychange', resync);
    window.addEventListener('focus', resync);
    window.addEventListener('online', resync);
    const slow = window.setInterval(resync, 5 * 60 * 1000);
    return () => { stopped = true; clearInterval(id); clearInterval(slow); document.removeEventListener('visibilitychange', resync); window.removeEventListener('focus', resync); window.removeEventListener('online', resync); };
  }, [serverNow, forcePhase, router]);

  const phase = forcePhase ?? computePhase(now, opensAt, endsAt);
  return (
    <ClockCtx.Provider value={{ now: forcePhase ? serverNow : now, phase }}>
      <div key={phase} className="fade" data-phase={phase}>{phase === 'pre' ? pre : phase === 'open' ? open : ended}</div>
    </ClockCtx.Provider>
  );
}
