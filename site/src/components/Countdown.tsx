import { useEffect, useState } from "react";

export function Countdown({ target }: { target: Date }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const ms = Math.max(0, target.getTime() - now);
  const parts = [
    ["dias", Math.floor(ms / 864e5)], ["horas", Math.floor(ms / 36e5) % 24],
    ["min", Math.floor(ms / 6e4) % 60], ["seg", Math.floor(ms / 1e3) % 60],
  ] as const;
  return (
    <div className="flex justify-center gap-3 md:gap-6" role="timer" aria-label="Contagem regressiva">
      {parts.map(([l, v]) => (
        <div key={l} className="min-w-[4.2rem] border border-[#ff5a3c]/40 bg-black/30 px-3 py-3 text-center">
          <div className="font-display text-4xl tabular-nums md:text-6xl">{String(v).padStart(2, "0")}</div>
          <div className="text-xs uppercase tracking-widest opacity-70">{l}</div>
        </div>
      ))}
    </div>
  );
}
