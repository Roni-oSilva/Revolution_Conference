export type Phase = "pre" | "live" | "post";

/** Fase do evento a partir das datas. `?fase=pos|ao-vivo|pre` força a fase para pré-visualizar. */
export function getPhase(start: Date, end: Date, now = new Date()): Phase {
  const forced = new URLSearchParams(window.location.search).get("fase");
  if (forced === "pos") return "post";
  if (forced === "ao-vivo") return "live";
  if (forced === "pre") return "pre";
  if (now >= end) return "post";
  if (now >= start) return "live";
  return "pre";
}
