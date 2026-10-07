import { HaloReel, type HaloReelItem } from "@/components/ui/halo-reel";
import { Hero } from "@/components/Hero";
import { useDriveMedia } from "@/hooks/useDriveMedia";

const FALLBACK: HaloReelItem[] = [
  { src: "/media/luciana.jpg", alt: "Pra. Luciana Gineli" },
  { title: "17 & 18", subtitle: "outubro · 2026" },
  { src: "/media/fazola.jpg", alt: "Pr. Guilherme Fazola" },
  { title: "Presença", subtitle: "Atos 2:1-3" },
  { src: "/media/ezeuiqsd.jpg", alt: "Ezequias Sousa" },
  { title: "19h30", subtitle: "Ulianópolis — PA" },
  { src: "/media/tiago.jpg", alt: "Pr. Tiago" },
  { title: "Revolução", subtitle: "Jovem Teen" },
];

export default function App() {
  const items = useDriveMedia(FALLBACK);

  return (
    <main>
      <Hero />

      <section className="bg-[#120605]">
        <HaloReel
          items={items}
          aria-label="Fotos e vídeos"
          cardWidth={150}
          cardHeight={210}
          holdDuration={1200}
          className="h-[640px]"
          centerLabel={
            <span className="font-display text-[8vw] leading-none text-[#ff5a3c] md:text-[3.6vw]">
              Momentos de Presença
            </span>
          }
        />
      </section>

      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <p className="text-2xl leading-relaxed text-[#f6e9dc]/90">
          “E, cumprindo-se o dia de Pentecostes, estavam todos reunidos no mesmo lugar. E de repente
          veio do céu um som, como de um vento veemente e impetuoso, e encheu toda a casa onde
          estavam assentados.” <span className="text-[#ff5a3c]">— Atos 2:1-2</span>
        </p>
        <a
          href="https://docs.google.com/forms/d/e/1FAIpQLSdSLltisaiLtvel6ZGcKl_bsKxTRU2kKCywtRL1rT-Mx5uwzQ/viewform?usp=header"
          target="_blank"
          rel="noreferrer"
          className="font-display mt-12 inline-block bg-[#e11d0c] px-10 py-4 text-3xl text-white transition hover:bg-[#ff2a14]"
        >
          Fazer inscrição
        </a>
        <p className="mt-10 text-lg opacity-70">R. Dom Teresa Cristina, 135 · Centro, Ulianópolis — PA</p>
      </section>
    </main>
  );
}
