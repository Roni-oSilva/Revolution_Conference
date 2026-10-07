import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";

const PRE = { lines: ["APAIXONADOS", "PELA", "PRESENÇA"], title: ["Apaixonados", "pela Presença"], sub: "17 E 18 DE OUTUBRO · ULIANÓPOLIS — PA" };
const POST = { lines: ["VIVEMOS", "ISSO."], title: ["Vivemos isso."], sub: "APAIXONADOS PELA PRESENÇA · 2026" };
export const HERO_COPY = { pre: PRE, post: POST };

function Ornament() {
  const petals = Array.from({ length: 48 }, (_, i) => i * (360 / 48));
  return (
    <svg viewBox="-200 -200 400 400" className="h-full w-full" aria-hidden>
      <circle r="196" fill="#8f0d07" stroke="#2b0503" strokeWidth="2" />
      <circle r="186" fill="none" stroke="#2b0503" strokeWidth="1" strokeDasharray="2 4" />
      {petals.map((a) => (
        <path
          key={a}
          d="M0 -176 C 7 -166 7 -156 0 -146 C -7 -156 -7 -166 0 -176 Z"
          transform={`rotate(${a})`}
          fill="none"
          stroke="#2b0503"
          strokeWidth="1.2"
        />
      ))}
      <circle r="138" fill="#b01209" stroke="#2b0503" strokeWidth="1.5" />
      <circle r="130" fill="none" stroke="#2b0503" strokeWidth="1" strokeDasharray="1 3" />
    </svg>
  );
}

export function Hero({ copy = PRE }: { copy?: typeof PRE }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });

  const doveY = useTransform(p, [0, 1], ["0vh", reduce ? "0vh" : "-85vh"]);
  const doveScale = useTransform(p, [0, 1], [1, 1.25]);
  const circleY = useTransform(p, [0, 1], ["0vh", reduce ? "0vh" : "80vh"]);
  const titleOpacity = useTransform(p, [0, 0.45], [1, 0]);
  const titleY = useTransform(p, [0, 0.45], ["0vh", "6vh"]);
  const left = useTransform(p, [0, 1], ["0vw", "-55vw"]);
  const right = useTransform(p, [0, 1], ["0vw", "55vw"]);
  const LINES = copy.lines.map((text, i) => ({ text, x: i % 2 === 0 ? left : right }));

  return (
    <section ref={ref} className="relative h-[260vh]" aria-label="Apaixonados pela Presença">
      <div
        className="sticky top-0 h-[100dvh] w-full overflow-hidden"
        style={{ background: "radial-gradient(120% 90% at 50% 40%, #ff2a14 0%, #c4150b 38%, #5a0503 100%)" }}
      >
        {/* nomes gigantes — cada linha segue para um lado */}
        <div className="absolute inset-0 z-0 flex flex-col items-center justify-center leading-[0.82]">
          {LINES.map((l) => (
            <motion.span
              key={l.text}
              style={{ x: l.x }}
              className="font-display whitespace-nowrap text-[26vw] text-black/80 md:text-[19vw]"
            >
              {l.text}
            </motion.span>
          ))}
        </div>

        {/* redondo ornamental — desce ao rolar */}
        <motion.div
          style={{ y: circleY }}
          className="absolute left-1/2 top-1/2 z-10 aspect-square w-[min(78vw,78vh)] -translate-x-1/2 -translate-y-1/2"
        >
          <Ornament />
        </motion.div>

        {/* pomba — sobe ao rolar */}
        <motion.img
          src="/media/dove.webp"
          alt="Pomba do Espírito Santo"
          style={{ y: doveY, scale: doveScale }}
          className="pointer-events-none absolute left-1/2 top-1/2 z-20 w-[min(110vw,120vh)] max-w-none -translate-x-1/2 -translate-y-1/2 mix-blend-screen [mask-image:radial-gradient(closest-side,#000_60%,transparent)]"
        />

        {/* título central */}
        <motion.h1
          style={{ opacity: titleOpacity, y: titleY }}
          className="absolute inset-x-0 top-[60%] z-30 text-center font-display text-[11vw] leading-[0.9] text-[#fff1e6] drop-shadow-[0_4px_18px_rgba(0,0,0,.55)] md:text-[6vw]"
        >
          {copy.title.map((t) => <span key={t} className="block">{t}</span>)}
        </motion.h1>

        <p className="absolute inset-x-0 bottom-6 z-30 text-center text-sm tracking-[0.3em] text-[#fff1e6]/80">
          {copy.sub}
        </p>
      </div>
    </section>
  );
}
