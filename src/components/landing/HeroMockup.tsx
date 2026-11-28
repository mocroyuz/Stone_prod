import type { CSSProperties, ReactNode } from "react";
import { SiInstagram, SiTiktok, SiX, SiYoutube } from "@icons-pack/react-simple-icons";

/**
 * Mockup du hero : un téléphone incliné qui montre l'app Stone, entouré
 * d'anneaux d'orbite sur lesquels tournent lentement des pastilles de
 * réseaux sociaux. Tout est en CSS/SVG (aucune image) et se met à l'échelle
 * avec la largeur de sa scène grâce aux unités de conteneur (cqw).
 */

const INK = "#0c0c0d";

const BARS = [38, 62, 46, 78, 54, 92, 66];

function PhoneScreen() {
  return (
    <div className="relative flex h-full flex-col bg-[#fafaf9] text-[#0c0c0d]">
      {/* barre d'état + île */}
      <div className="relative flex h-[10cqw] shrink-0 items-center justify-between px-[7cqw] pt-[2cqw] text-[3.1cqw] font-semibold">
        <span>9:41</span>
        <span className="absolute left-1/2 top-[2.4cqw] h-[6.2cqw] w-[24cqw] -translate-x-1/2 rounded-full bg-[#0c0c0d]" />
        <span className="flex items-center gap-[1cqw]">
          <span className="h-[2cqw] w-[3.4cqw] rounded-[0.6cqw] bg-[#0c0c0d]" />
          <span className="h-[2.2cqw] w-[4.6cqw] rounded-[0.7cqw] bg-[#0c0c0d]" />
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-[3.4cqw] px-[5cqw] pt-[2.4cqw]">
        {/* salutation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[2.4cqw]">
            <img
              src="/images/landing/avatar-1.jpg"
              alt=""
              aria-hidden="true"
              decoding="async"
              className="h-[8.6cqw] w-[8.6cqw] rounded-full object-cover"
            />
            <div className="leading-tight">
              <div className="text-[2.8cqw] text-neutral-500">Good morning</div>
              <div className="text-[3.8cqw] font-semibold tracking-[-0.02em]">Alex</div>
            </div>
          </div>
          <span className="flex h-[8.6cqw] w-[8.6cqw] items-center justify-center rounded-full bg-white shadow-[0_0_0_0.3cqw_rgba(0,0,0,0.06)]">
            <span className="h-[3.2cqw] w-[3.2cqw] rounded-full border-[0.5cqw] border-[#0c0c0d]" />
          </span>
        </div>

        {/* carte sombre : semaine */}
        <div className="rounded-[5.4cqw] bg-[#0c0c0d] p-[4.4cqw] text-white shadow-[0_3cqw_5cqw_-3cqw_rgba(0,0,0,0.5)]">
          <div className="text-[2.8cqw] text-[rgba(255,255,255,0.6)]">Scheduled this week</div>
          <div className="mt-[0.8cqw] flex items-end justify-between">
            <div className="text-[8.4cqw] font-semibold leading-none tracking-[-0.04em]">24 posts</div>
            <div className="flex h-[11cqw] items-end gap-[1.5cqw]">
              {BARS.map((h, i) => (
                <span
                  key={i}
                  className="w-[2.3cqw] rounded-t-[0.8cqw]"
                  style={{ height: `${h}%`, background: i === 5 ? "#f7cfcf" : "rgba(255,255,255,0.28)" }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* canaux */}
        <div className="flex items-center justify-between">
          <span className="text-[3.5cqw] font-semibold tracking-[-0.02em]">Channels</span>
          <span className="text-[2.8cqw] text-neutral-500">4 connected</span>
        </div>
        <div className="flex gap-[2.6cqw]">
          {[SiInstagram, SiX, SiTiktok, SiYoutube].map((Icon, i) => (
            <span
              key={i}
              className="flex h-[11.4cqw] w-[11.4cqw] items-center justify-center rounded-full bg-white shadow-[0_0_0_0.3cqw_rgba(0,0,0,0.07)]"
            >
              <Icon color={INK} className="h-[4.8cqw] w-[4.8cqw]" aria-hidden="true" />
            </span>
          ))}
        </div>

        {/* à venir */}
        <div className="flex items-center justify-between">
          <span className="text-[3.5cqw] font-semibold tracking-[-0.02em]">Up next</span>
          <span className="text-[2.8cqw] text-neutral-500">See all</span>
        </div>
        {[
          { img: "/images/landing/hands.jpg", title: "Spring drop teaser", meta: "Instagram · 3:30 PM" },
          { img: "/images/landing/hero-card.jpg", title: "Behind the scenes", meta: "TikTok · 6:00 PM" },
          { img: "/images/landing/analytics-portrait.jpg", title: "Weekly recap", meta: "X · Tomorrow 9:00 AM" },
        ].map((row) => (
          <div
            key={row.title}
            className="flex items-center gap-[2.6cqw] rounded-[4.2cqw] bg-white p-[2.2cqw] shadow-[0_0_0_0.3cqw_rgba(0,0,0,0.06)]"
          >
            <img
              src={row.img}
              alt=""
              aria-hidden="true"
              decoding="async"
              className="h-[10.4cqw] w-[10.4cqw] shrink-0 rounded-[2.8cqw] object-cover"
            />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[3.2cqw] font-medium tracking-[-0.01em]">{row.title}</div>
              <div className="mt-[0.6cqw] truncate text-[2.6cqw] text-neutral-500">{row.meta}</div>
            </div>
            <span className="shrink-0 rounded-full bg-[#f7cfcf] px-[2.1cqw] py-[0.7cqw] text-[2.2cqw] font-semibold uppercase tracking-[0.04em] text-[#9b3a3a]">
              Scheduled
            </span>
          </div>
        ))}

        {/* meilleur créneau */}
        <div className="flex items-center justify-between rounded-[4.2cqw] bg-white p-[3cqw] shadow-[0_0_0_0.3cqw_rgba(0,0,0,0.06)]">
          <div className="leading-tight">
            <div className="text-[2.6cqw] text-neutral-500">Best time today</div>
            <div className="mt-[0.6cqw] text-[5cqw] font-semibold tracking-[-0.03em]">6:30 PM</div>
          </div>
          <svg viewBox="0 0 80 28" className="h-[9cqw] w-[26cqw]" fill="none" aria-hidden="true">
            <path d="M2 24 C 12 22, 18 10, 30 12 S 48 22, 58 8 S 72 6, 78 4" stroke="#0c0c0d" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="58" cy="8" r="2.6" fill="#f7cfcf" stroke="#0c0c0d" strokeWidth="1.2" />
          </svg>
        </div>

        {/* barre d'onglets */}
        <div className="mt-auto mb-[3.4cqw] flex items-center justify-between self-center rounded-full bg-[#0c0c0d] px-[4cqw] py-[2.6cqw] w-[66cqw]">
          <span className="h-[6.6cqw] w-[6.6cqw] rounded-full bg-white" />
          <span className="h-[4.4cqw] w-[4.4cqw] rounded-[1.2cqw] border-[0.5cqw] border-[rgba(255,255,255,0.55)]" />
          <span className="h-[4.4cqw] w-[4.4cqw] rounded-full border-[0.5cqw] border-[rgba(255,255,255,0.55)]" />
          <span className="h-[4.4cqw] w-[4.4cqw] rounded-[1.2cqw] border-[0.5cqw] border-[rgba(255,255,255,0.55)]" />
        </div>
      </div>
    </div>
  );
}

function Phone() {
  return (
    <div className="mock-phone-wrap absolute left-1/2 top-[7%] w-[50%] -translate-x-1/2 [perspective:1600px]">
      <div className="mock-bob">
        <div
          className="@container relative [container-type:inline-size]"
          style={{ transform: "rotateX(5deg) rotateY(-17deg) rotateZ(-8deg)", transformStyle: "preserve-3d" }}
        >
          {/* boutons latéraux */}
          <span className="absolute -left-[0.9cqw] top-[22cqw] h-[8cqw] w-[1.2cqw] rounded-l-[0.6cqw] bg-[#9c978f]" />
          <span className="absolute -left-[0.9cqw] top-[33cqw] h-[13cqw] w-[1.2cqw] rounded-l-[0.6cqw] bg-[#9c978f]" />

          {/* cadre titane */}
          <div className="rounded-[15cqw] bg-[#b9b4ac] p-[0.9cqw] shadow-[0_8cqw_10cqw_-5cqw_rgba(0,0,0,0.38),0_2cqw_3cqw_-1cqw_rgba(0,0,0,0.2)]">
            <div className="rounded-[14.2cqw] bg-[#0c0c0d] p-[2.1cqw]">
              <div className="aspect-[9/19.2] overflow-hidden rounded-[12.4cqw] bg-white">
                <PhoneScreen />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HeroMockup({ className = "" }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="The Stone app displayed on a smartphone"
      className={["@container relative aspect-[1/1.12] overflow-hidden [container-type:inline-size]", className].join(" ")}
      style={{
        maskImage: "linear-gradient(to bottom, #000 0%, #000 72%, rgba(0,0,0,0.6) 88%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, #000 0%, #000 72%, rgba(0,0,0,0.6) 88%, transparent 100%)",
      }}
    >

      <Phone />
    </div>
  );
}
