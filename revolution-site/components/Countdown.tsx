'use client';
import { countdownParts } from '@/lib/phase';
import { useClock } from './PhaseGate';

export function Countdown({ targetMs }: { targetMs: number }) {
  const { now } = useClock();
  const p = countdownParts(targetMs - now);
  const pad = (n: number) => String(n).padStart(2, '0');
  const cell = (v: string, l: string) => (<div><b>{v}</b><span>{l}</span></div>);
  return (
    <div role="timer" aria-label={`Faltam ${p.days} dias, ${p.hours} horas, ${p.minutes} minutos e ${p.seconds} segundos`} className="count">
      {cell(pad(p.days), 'Dias')}{cell(pad(p.hours), 'Horas')}{cell(pad(p.minutes), 'Min')}{cell(pad(p.seconds), 'Seg')}
    </div>
  );
}
