import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { HaloReel, type HaloReelItem } from "@/components/ui/halo-reel";
import { Hero, HERO_COPY } from "@/components/Hero";
import { Countdown } from "@/components/Countdown";
import { fetchMedia, useCurrentEvent } from "@/lib/data";
import { getPhase } from "@/lib/phase";

const START = new Date("2026-10-17T19:30:00-03:00");
const END = new Date("2026-10-18T23:59:00-03:00");
const FORM = "https://docs.google.com/forms/d/e/1FAIpQLSdSLltisaiLtvel6ZGcKl_bsKxTRU2kKCywtRL1rT-Mx5uwzQ/viewform?usp=header";

const FALLBACK: HaloReelItem[] = [
  { src: "/media/luciana.jpg", alt: "Pra. Luciana Gineli" }, { title: "17 & 18", subtitle: "outubro · 2026" },
  { src: "/media/fazola.jpg", alt: "Pr. Guilherme Fazola" }, { title: "Presença", subtitle: "Atos 2:1-3" },
  { src: "/media/ezeuiqsd.jpg", alt: "Ezequias Sousa" }, { title: "19h30", subtitle: "Ulianópolis — PA" },
  { src: "/media/tiago.jpg", alt: "Pr. Tiago" }, { title: "Revolução", subtitle: "Jovem Teen" },
];

export default function Home() {
  const { event } = useCurrentEvent();
  const start = event ? new Date(event.start_date) : START;
  const end = event ? new Date(event.end_date) : END;
  const phase = getPhase(start, end);
  const post = phase === "post";

  // pós-conferência: carrossel com fotos/vídeos em destaque (ordem aleatória) vindas do Supabase
  const [items, setItems] = useState<HaloReelItem[]>(FALLBACK);
  useEffect(() => {
    if (!event) return;
    Promise.all([
      fetchMedia("photo", event.id, { from: 0, to: 39, featured: true }),
      fetchMedia("video", event.id, { from: 0, to: 9, featured: true }),
    ]).then(([p, v]) => {
      const all: HaloReelItem[] = [
        ...p.map((m) => ({ src: m.thumbnail_url ?? undefined, alt: m.title })),
        ...v.map((m) => ({ src: m.thumbnail_url ?? undefined, alt: m.title })),
      ].filter((i) => i.src);
      if (all.length >= 4) setItems(all.sort(() => Math.random() - 0.5));
    });
  }, [event]);

  return (
    <main>
      <Hero copy={post ? HERO_COPY.post : HERO_COPY.pre} />

      {post ? (
        <section className="mx-auto max-w-5xl px-4 py-16 text-center">
          <h2 className="mb-8 text-5xl md:text-7xl">Momentos</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[["/fotos", "Fotos"], ["/videos", "Vídeos"], ["/comunidade", "Comunidade"], ["/comunidade#testemunhos", "Testemunhos"]].map(([to, l]) => (
              <Link key={to} to={to} className="border border-[#ff5a3c]/50 p-8 font-display text-3xl transition hover:bg-[#e11d0c]">{l}</Link>
            ))}
          </div>
          <Link to="/fotos" className="btn mt-10 inline-block px-10 py-4 text-3xl">VER TODAS AS FOTOS</Link>
        </section>
      ) : (
        <section className="px-4 py-16 text-center">
          <h2 className="mb-6 text-4xl md:text-6xl">{phase === "live" ? "Estamos vivendo isso agora" : "Falta pouco"}</h2>
          <Countdown target={phase === "live" ? end : start} />
          <a href={FORM} target="_blank" rel="noreferrer" className="btn mt-10 inline-block px-10 py-4 text-3xl">Fazer inscrição</a>
        </section>
      )}

      <HaloReel items={items} aria-label="Momentos da conferência" cardWidth={150} cardHeight={210} holdDuration={1200}
        className="h-[620px] bg-[#120605]"
        centerLabel={<span className="font-display text-[8vw] leading-none text-[#ff5a3c] md:text-[3.6vw]">{post ? "Vivemos isso." : "Momentos de Presença"}</span>} />

      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <p className="text-2xl leading-relaxed opacity-90">
          “E, cumprindo-se o dia de Pentecostes, estavam todos reunidos no mesmo lugar.”{" "}
          <span className="text-[#ff5a3c]">— Atos 2:1</span>
        </p>
        <p className="mt-8 opacity-70">R. Dom Teresa Cristina, 135 · Centro, Ulianópolis — PA</p>
      </section>
    </main>
  );
}
