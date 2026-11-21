import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Asterisk,
  Bot,
  Brain,
  Camera,
  ChartColumn,
  ClipboardList,
  Ellipsis,
  Flower,
  Globe,
  Menu,
  Microscope,
  Pill,
  Repeat,
  Ribbon,
  Scan,
  ScanFace,
  Stethoscope,
  Syringe,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  DotField,
  LogoBurst,
  LogoHues,
  LogoInvert,
  LogoOrbit,
  LogoPollinate,
  LogoWaves,
  PetalSpinner,
} from "../components/landing/LandingGraphics";

/* ============================================================
   CONTENU
============================================================ */

const IMG = {
  heroPortrait: "/images/landing/hero-portrait.jpg",
  heroCard: "/images/landing/hero-card.jpg",
  avatars: [
    "/images/landing/avatar-1.jpg",
    "/images/landing/avatar-2.jpg",
    "/images/landing/avatar-3.jpg",
  ],
  analyticsPortrait: "/images/landing/analytics-portrait.jpg",
  hands: "/images/landing/hands.jpg",
  stoneMark: "/images/landing/stone-mark.png",
};

type NavLink =
  | { label: string; section: string }
  | { label: string; href: string };

const NAV_LINKS: NavLink[] = [
  { label: "Home", section: "top" },
  { label: "Solutions", section: "features" },
  { label: "Technology", section: "workflows" },
  { label: "Pricing", href: "/pricing" },
  { label: "About", section: "analytics" },
];

const PARTNERS: Array<{ key: string; node: ReactNode }> = [
  { key: "orbit", node: <LogoOrbit className="h-8 w-8" /> },
  {
    key: "invert",
    node: (
      <span className="flex items-center gap-1.5">
        <LogoInvert className="h-[22px] w-[22px]" />
        <span className="text-[19px] font-semibold tracking-[-0.03em]">Invert</span>
      </span>
    ),
  },
  { key: "burst", node: <LogoBurst className="h-10 w-10" /> },
  {
    key: "hues",
    node: (
      <span className="flex items-center gap-1">
        <LogoHues className="h-[18px] w-[18px]" />
        <span className="text-[20px] font-semibold tracking-[-0.04em]">hues</span>
      </span>
    ),
  },
  { key: "waves", node: <LogoWaves className="h-8 w-8" /> },
  {
    key: "pollinate",
    node: (
      <span className="flex items-center gap-1.5">
        <LogoPollinate className="h-6 w-6" />
        <span className="text-[17px] font-semibold tracking-[-0.03em]">Pollinate</span>
      </span>
    ),
  },
];

const FEATURES: Array<{ icon: LucideIcon; title: string; text: string }> = [
  {
    icon: Asterisk,
    title: "AI Symptom Checker",
    text: "Get accurate suggestions within seconds. AI workflows that connect to your data.",
  },
  {
    icon: ClipboardList,
    title: "Smart Health Reports",
    text: "AI-generated summaries and next steps that connect to your data and tools.",
  },
  {
    icon: Bot,
    title: "24/7 Virtual Health Assistant",
    text: "Answering all health queries anytime, connected to your data and tools.",
  },
];

const FAQS = [
  "Is the AI diagnosis accurate?",
  "Will my health data stay private and secure?",
  "Can I consult a real doctor after the AI report?",
  "How does the AI symptom checker work?",
  "Can the AI help in emergency situations?",
];

const FOOTER_COLUMNS: Array<{
  title: string;
  links: Array<{ label: string; href?: string }>;
}> = [
  {
    title: "Platform",
    links: [
      { label: "Data warehouse" },
      { label: "Product Analytics" },
      { label: "Session Replay" },
      { label: "Data warehouse" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Us" },
      { label: "Careers" },
      { label: "Resources", href: "/faq" },
      { label: "Terms", href: "/tos" },
      { label: "Web Analytics" },
    ],
  },
  {
    title: "Platform",
    links: [
      { label: "Startup Program" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Join Community" },
      { label: "Events" },
      { label: "Status" },
      { label: "Data warehouse" },
    ],
  },
];

/* ============================================================
   PRIMITIVES
============================================================ */

const HAIR = "border-black/[0.075]";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

const BTN_DARK =
  "bg-[#0c0c0d] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_2px_rgba(0,0,0,0.28),0_10px_22px_-10px_rgba(0,0,0,0.5)] transition duration-200 hover:bg-[#1d1d20] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_4px_rgba(0,0,0,0.28),0_14px_26px_-10px_rgba(0,0,0,0.55)] active:translate-y-px";

const BTN_LIGHT =
  "bg-white text-neutral-900 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.05),0_8px_20px_-12px_rgba(0,0,0,0.18)] transition duration-200 hover:shadow-[0_0_0_1px_rgba(0,0,0,0.09),0_2px_4px_rgba(0,0,0,0.06),0_12px_24px_-12px_rgba(0,0,0,0.22)] active:translate-y-px";

const SOFT_CARD =
  "bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_2px_4px_rgba(0,0,0,0.03),0_16px_32px_-16px_rgba(0,0,0,0.14)]";

/** Colonne centrale bordée à gauche et à droite par un filet. */
function Col({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "mx-auto w-full max-w-[1313px] border-x",
        HAIR,
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

/** Rangée pleine largeur (le filet traverse les marges). */
function Bleed({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={["border-b", HAIR, className].join(" ")}>
      {children}
    </section>
  );
}

/** Pastille « New · texte » / « AI · texte ». */
function Badge({ chip, label }: { chip: string; label: string }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full p-[3px] pr-3.5 text-[12px] font-medium text-neutral-700",
        SOFT_CARD,
      ].join(" ")}
    >
      <span className="rounded-full bg-[#f7cfcf] px-2.5 py-[3px] text-[10px] font-semibold uppercase tracking-[0.04em] text-[#9b3a3a] shadow-[inset_0_0_0_1px_rgba(155,58,58,0.12)]">
        {chip}
      </span>
      {label}
    </span>
  );
}

/** « // Label // » centré. */
function SectionTag({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-3 text-[12px] font-medium text-neutral-400">
      <span aria-hidden="true">//</span>
      <span
        className={[
          "rounded-full px-3.5 py-1.5 text-neutral-900",
          SOFT_CARD,
        ].join(" ")}
      >
        {children}
      </span>
      <span aria-hidden="true">//</span>
    </div>
  );
}

function TextLink({ children }: { children: ReactNode }) {
  return (
    <a
      href="/signup"
      className={[
        "group inline-flex items-center gap-2 rounded-md text-[14px] font-medium text-neutral-900",
        FOCUS,
      ].join(" ")}
    >
      {children}
      <ArrowRight
        className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
        strokeWidth={1.8}
      />
    </a>
  );
}

function MiniTag({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[11.5px] font-medium text-neutral-800">
      <Icon className="h-3.5 w-3.5 text-neutral-600" strokeWidth={1.6} />
      {label}
    </span>
  );
}

function StoneLogoMark() {
  return (
    <img
      src={IMG.stoneMark}
      alt=""
      aria-hidden="true"
      decoding="async"
      className="h-[28px] w-auto"
    />
  );
}

function scrollToSection(id: string) {
  if (id === "top") {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  document.getElementById(id)?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
    block: "start",
  });
}

/* ============================================================
   HEADER
============================================================ */

function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const go = (id: string) => {
    setOpen(false);
    scrollToSection(id);
  };

  return (
    <header
      className={[
        "fixed inset-x-0 top-0 z-50 border-b bg-white/60 backdrop-blur-xl backdrop-saturate-150 transition-shadow duration-300",
        HAIR,
        scrolled ? "shadow-[0_10px_30px_-18px_rgba(0,0,0,0.25)]" : "shadow-none",
      ].join(" ")}
    >
      <Col className="relative flex h-[72px] items-center justify-between px-3 sm:px-5 lg:h-[90px]">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            go("top");
          }}
          aria-label="Stone — home"
          className={["flex items-center gap-2 rounded-md", FOCUS].join(" ")}
        >
          <StoneLogoMark />
          <span className="text-[21px] font-bold tracking-[-0.045em]">
            Stone
          </span>
        </a>

        <nav
          aria-label="Main"
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-0.5 rounded-full p-1 shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.03)] md:flex"
        >
          {NAV_LINKS.map((link, index) => {
            const base = [
              "rounded-full px-[18px] py-2 text-[13px] font-medium tracking-[-0.01em] transition duration-200",
              FOCUS,
            ];
            const cls =
              index === 0
                ? [
                    ...base,
                    "bg-[#0c0c0d] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_2px_6px_-1px_rgba(0,0,0,0.35)]",
                  ]
                : [...base, "text-neutral-400 hover:text-neutral-900"];
            return "href" in link ? (
              <a key={link.label} href={link.href} className={cls.join(" ")}>
                {link.label}
              </a>
            ) : (
              <button
                key={link.label}
                type="button"
                onClick={() => go(link.section)}
                className={cls.join(" ")}
              >
                {link.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href="/signup"
            className={[
              "inline-flex h-12 items-center justify-center rounded-full bg-white px-7 text-[14px] font-semibold normal-case tracking-[-0.02em] text-[#111] shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_2px_4px_rgba(0,0,0,0.05),0_8px_20px_-12px_rgba(0,0,0,0.18)] transition duration-200 hover:bg-neutral-100 active:translate-y-px",
              FOCUS,
            ].join(" ")}
          >
            Get started
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
          </a>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="landing-mobile-menu"
            onClick={() => setOpen((v) => !v)}
            className={[
              "flex h-11 w-11 items-center justify-center rounded-full md:hidden",
              BTN_LIGHT,
              FOCUS,
            ].join(" ")}
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        {open && (
          <div
            id="landing-mobile-menu"
            className={[
              "absolute inset-x-3 top-full mt-2 rounded-2xl p-2 md:hidden",
              SOFT_CARD,
            ].join(" ")}
          >
            {NAV_LINKS.map((link) =>
              "href" in link ? (
                <a
                  key={link.label}
                  href={link.href}
                  className="block rounded-xl px-4 py-3 text-[15px] font-medium text-neutral-800 hover:bg-neutral-100"
                >
                  {link.label}
                </a>
              ) : (
                <button
                  key={link.label}
                  type="button"
                  onClick={() => go(link.section)}
                  className="block w-full rounded-xl px-4 py-3 text-left text-[15px] font-medium text-neutral-800 hover:bg-neutral-100"
                >
                  {link.label}
                </button>
              )
            )}
          </div>
        )}
      </Col>
    </header>
  );
}

/* ============================================================
   HERO
============================================================ */

function Hero() {
  return (
    <Bleed>
      <Col className="relative overflow-hidden">
        <DotField
          className="left-0 top-0 h-[300px] w-[420px]"
          mask="radial-gradient(ellipse at 20% 30%, #000 0%, transparent 70%)"
          strength={0.12}
        />

        <div className="relative grid lg:grid-cols-[minmax(0,42%)_minmax(0,58%)]">
          <div className="px-5 pb-6 pt-12 sm:px-7 lg:pb-0 lg:pt-[88px]">
            <Badge chip="New" label="Trusted by 45+ expert medical teams" />

            <h1 className="mt-6 text-[clamp(40px,4.9vw,70px)] font-medium leading-[1.06] tracking-[-0.05em] text-[#0c0c0d]">
              <span className="block sm:whitespace-nowrap">Revolutionizing</span>
              <span className="block sm:whitespace-nowrap">Healthcare with AI</span>
            </h1>

            <p className="mt-7 max-w-[500px] text-[16.5px] leading-[1.7] tracking-[-0.01em] text-neutral-500">
              Automated workflows, AI-powered reporting, and real-time decision
              support so your clinical team can do what they were trained to do.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href="/signup"
                className={[
                  "inline-flex h-[54px] items-center rounded-full px-8 text-[12px] font-semibold uppercase tracking-[0.03em]",
                  BTN_DARK,
                  FOCUS,
                ].join(" ")}
              >
                Start diagnosis
              </a>
              <a
                href="/signin"
                className={[
                  "inline-flex h-[54px] items-center rounded-full px-8 text-[12px] font-semibold uppercase tracking-[0.03em]",
                  BTN_LIGHT,
                  FOCUS,
                ].join(" ")}
              >
                Talk to AI doctor
              </a>
            </div>
          </div>

          {/* Composition visuelle : tout est positionné en % pour rester
              proportionnel à toutes les largeurs. */}
          <div className="relative mx-auto aspect-[760/840] w-full max-w-[560px] lg:max-w-none">
            <img
              src={IMG.heroPortrait}
              alt="Profile portrait of a woman with a shaved head, eyes closed"
              width={820}
              height={896}
              decoding="async"
              fetchPriority="high"
              className="absolute right-0 top-[1.5%] w-[82%] mix-blend-multiply lg:w-[78%]"
            />

            <div
              className={[
                "absolute bottom-[16%] left-[2%] w-[36%] rounded-[20px] p-2 lg:bottom-auto lg:left-[12.5%] lg:top-[54%] lg:w-[28.5%]",
                SOFT_CARD,
              ].join(" ")}
            >
              <img
                src={IMG.heroCard}
                alt=""
                width={355}
                height={275}
                loading="lazy"
                className="aspect-[71/55] w-full rounded-[12px] object-cover"
              />
              <div className="px-1 pb-1 pt-2.5">
                <p className="text-[15px] font-medium leading-none tracking-[-0.03em] text-neutral-900">
                  5,000+
                </p>
                <p className="mt-1.5 text-[11px] leading-none text-neutral-400">
                  Successful Treatment
                </p>
              </div>
            </div>

            <div
              className={[
                "absolute bottom-[2%] right-[2%] flex items-center gap-3 rounded-full py-2 pl-2.5 pr-5 lg:bottom-auto lg:right-[11%] lg:top-[75%]",
                SOFT_CARD,
              ].join(" ")}
            >
              <div className="flex -space-x-2.5">
                {IMG.avatars.map((src) => (
                  <img
                    key={src}
                    src={src}
                    alt=""
                    width={112}
                    height={112}
                    loading="lazy"
                    className="h-8 w-8 rounded-full object-cover ring-2 ring-white"
                  />
                ))}
              </div>
              <div>
                <p className="text-[15px] font-medium leading-none tracking-[-0.03em] text-neutral-900">
                  45+
                </p>
                <p className="mt-1 text-[10.5px] leading-none text-neutral-400">
                  Expert Doctors
                </p>
              </div>
            </div>
          </div>
        </div>
      </Col>
    </Bleed>
  );
}

/* ============================================================
   BANDEAU DE LOGOS
============================================================ */

function TrustedBy() {
  return (
    <Bleed>
      <Col>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
          <div
            className={[
              "col-span-2 flex items-center px-7 py-8 sm:col-span-4 lg:col-span-1 lg:h-[200px] lg:py-0",
            ].join(" ")}
          >
            <p className="max-w-[140px] text-[14px] leading-[1.35] tracking-[-0.02em] text-neutral-700">
              Trusted by medical teams and hospitals
            </p>
          </div>
          {PARTNERS.map((partner) => (
            <div
              key={partner.key}
              className={[
                "flex h-[110px] items-center justify-center border-l text-[#0c0c0d] lg:h-[200px]",
                HAIR,
              ].join(" ")}
            >
              {partner.node}
            </div>
          ))}
        </div>
      </Col>
    </Bleed>
  );
}

/* ============================================================
   INTERMÈDE : fleur + « 01 / 05 · FEATURES »
============================================================ */

function Interlude() {
  return (
    <div className={["border-b", HAIR].join(" ")}>
      <Col>
        <div
          className={[
            "relative flex h-[200px] items-center justify-center border-b lg:h-[275px]",
            HAIR,
          ].join(" ")}
        >
          <DotField
            className="left-0 top-0 h-[85%] w-[34%]"
            mask="linear-gradient(135deg, #000 0%, transparent 85%)"
            strength={0.14}
          />
          <PetalSpinner className="relative h-[60px] w-[60px] animate-[spin_24s_linear_infinite] text-[#0c0c0d] motion-reduce:animate-none lg:h-[84px] lg:w-[84px]" />
        </div>
        <div className="flex h-[88px] items-center justify-center gap-4 text-[11px] font-medium uppercase tracking-[0.08em] tabular-nums lg:h-[125px]">
          <span>
            <span className="text-neutral-900">01</span>
            <span className="text-neutral-300"> / 05</span>
          </span>
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-neutral-300" />
          <span className="text-neutral-400">Features</span>
        </div>
      </Col>
    </div>
  );
}

/* ============================================================
   FONCTIONNALITÉS
============================================================ */

function Features() {
  const [active, setActive] = useState<number | null>(null);

  return (
    <Bleed id="features" className="scroll-mt-24">
      <Col>
        <div className={["border-b px-5 pb-14 pt-16 text-center sm:px-7 lg:pb-[64px] lg:pt-[84px]", HAIR].join(" ")}>
          <Badge chip="AI" label="AI Support" />
          <h2 className="mt-6 text-[clamp(34px,4vw,56px)] font-medium leading-[1.05] tracking-[-0.05em] text-[#0c0c0d]">
            AI-powered healthcare support.
          </h2>
          <p className="mx-auto mt-5 max-w-[560px] text-[15px] leading-[1.7] tracking-[-0.01em] text-neutral-500">
            Stone pairs powerful AI with governance, security and workflow
            integrations so your team can automate support without losing your
            voice.
          </p>
        </div>

        <ul
          className="grid md:grid-cols-3"
          onMouseLeave={() => setActive(null)}
        >
          {FEATURES.map(({ icon: Icon, title, text }, index) => {
            const isActive = active === index;
            return (
              <li
                key={title}
                className={[
                  "relative p-2.5 md:p-[22px]",
                  index > 0 ? `border-t md:border-l md:border-t-0 ${HAIR}` : "",
                ].join(" ")}
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
              >
                <div
                  tabIndex={0}
                  className={[
                    "flex min-h-[300px] flex-col items-center rounded-[26px] px-8 pt-[62px] text-center outline-none transition duration-300 ease-out lg:min-h-[300px]",
                    isActive
                      ? "-translate-y-1.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_4px_8px_rgba(0,0,0,0.04),0_28px_48px_-20px_rgba(0,0,0,0.2)]"
                      : "translate-y-0",
                  ].join(" ")}
                >
                  <Icon
                    className="h-7 w-7 text-neutral-700"
                    strokeWidth={1.3}
                    aria-hidden="true"
                  />
                  <h3 className="mt-[34px] text-[21px] font-medium leading-tight tracking-[-0.035em] text-[#0c0c0d]">
                    {title}
                  </h3>
                  <p className="mt-3.5 max-w-[290px] text-[13.5px] leading-[1.65] text-neutral-500">
                    {text}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </Col>
    </Bleed>
  );
}

/* ============================================================
   WORKFLOWS (deux cartes)
============================================================ */

function OrbitVisual() {
  const bubble =
    "absolute flex h-[68px] w-[68px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-neutral-800 shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_2px_4px_rgba(0,0,0,0.04),0_14px_28px_-12px_rgba(0,0,0,0.18)] sm:h-[84px] sm:w-[84px]";
  const dot =
    "absolute h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-300";

  return (
    <div className="relative h-[360px] overflow-hidden bg-[#f6f6f6] sm:h-[448px]">
      {/* halo rosé : seul accent coloré de la maquette */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 62% 52% at 0% 100%, rgba(246,170,170,0.42) 0%, rgba(246,170,170,0.14) 48%, transparent 78%)",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-[290px] w-[290px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/[0.045]"
      />

      <span className={dot} style={{ left: "30%", top: "32%" }} />
      <span className={dot} style={{ left: "69%", top: "32%" }} />
      <span className={dot} style={{ left: "50%", top: "83%" }} />

      <span className={bubble} style={{ left: "50%", top: "17%" }}>
        <Microscope className="h-[22px] w-[22px]" strokeWidth={1.4} />
      </span>
      <span className={bubble} style={{ left: "28%", top: "61%" }}>
        <Brain className="h-[22px] w-[22px]" strokeWidth={1.4} />
      </span>
      <span className={bubble} style={{ left: "71%", top: "61%" }}>
        <Flower className="h-[22px] w-[22px]" strokeWidth={1.4} />
      </span>

      <span className="absolute left-1/2 top-1/2 flex h-[50px] w-[50px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#0c0c0d] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_20px_-8px_rgba(0,0,0,0.5)]">
        <span className="h-3 w-3 rounded-full border-[3px] border-white/90" />
      </span>
    </div>
  );
}

function NetworkVisual() {
  const side: Array<{ icon: LucideIcon; x: number; y: number }> = [
    { icon: ClipboardList, x: 13, y: 23 },
    { icon: Stethoscope, x: 19, y: 39 },
    { icon: Camera, x: 19, y: 61 },
    { icon: Ribbon, x: 13, y: 77 },
    { icon: Pill, x: 87, y: 23 },
    { icon: Syringe, x: 81, y: 39 },
    { icon: ScanFace, x: 81, y: 61 },
    { icon: Scan, x: 87, y: 77 },
  ];

  return (
    <div className="relative h-[360px] overflow-hidden bg-[#f6f6f6] sm:h-[448px]">
      <DotField
        className="left-1/2 top-1/2 h-[260px] w-[300px] -translate-x-1/2 -translate-y-1/2"
        strength={0.1}
        mask="radial-gradient(closest-side, #000 20%, transparent 100%)"
      />

      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        fill="none"
        stroke="rgba(0,0,0,0.05)"
        strokeWidth="0.35"
        vectorEffect="non-scaling-stroke"
      >
        <path d="M13 23 C 30 23, 34 50, 44 50" vectorEffect="non-scaling-stroke" />
        <path d="M19 39 C 30 39, 36 50, 44 50" vectorEffect="non-scaling-stroke" />
        <path d="M19 61 C 30 61, 36 50, 44 50" vectorEffect="non-scaling-stroke" />
        <path d="M13 77 C 30 77, 34 50, 44 50" vectorEffect="non-scaling-stroke" />
        <path d="M87 23 C 70 23, 66 50, 56 50" vectorEffect="non-scaling-stroke" />
        <path d="M81 39 C 70 39, 64 50, 56 50" vectorEffect="non-scaling-stroke" />
        <path d="M81 61 C 70 61, 64 50, 56 50" vectorEffect="non-scaling-stroke" />
        <path d="M87 77 C 70 77, 66 50, 56 50" vectorEffect="non-scaling-stroke" />
      </svg>

      {side.map(({ icon: Icon, x, y }) => (
        <span
          key={`${x}-${y}`}
          className="absolute flex h-[46px] w-[46px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-neutral-700 shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_2px_4px_rgba(0,0,0,0.04),0_10px_20px_-10px_rgba(0,0,0,0.16)] sm:h-[52px] sm:w-[52px]"
          style={{ left: `${x}%`, top: `${y}%` }}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.4} />
        </span>
      ))}

      <span
        className="absolute h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0c0c0d]"
        style={{ left: "37%", top: "50%" }}
      />
      <span
        className="absolute h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0c0c0d]"
        style={{ left: "63%", top: "50%" }}
      />
      <span className="absolute left-1/2 top-1/2 flex h-[54px] -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-[#0c0c0d] px-6 text-[14px] font-medium tracking-[-0.02em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_14px_28px_-10px_rgba(0,0,0,0.55)]">
        <span aria-hidden="true" className="text-white/50">
          ‹
        </span>
        Stone
        <span aria-hidden="true" className="text-white/50">
          ›
        </span>
      </span>
    </div>
  );
}

function WorkflowCard({
  visual,
  tag,
  title,
  text,
}: {
  visual: ReactNode;
  tag: { icon: LucideIcon; label: string };
  title: string;
  text: string;
}) {
  return (
    <article className="flex flex-col bg-white">
      {visual}
      <div className="flex flex-1 flex-col px-7 pb-10 pt-[72px] sm:px-[46px]">
        <MiniTag icon={tag.icon} label={tag.label} />
        <h3 className="mt-[26px] text-[clamp(22px,2vw,28px)] font-medium leading-tight tracking-[-0.04em] text-[#0c0c0d]">
          {title}
        </h3>
        <p className="mt-3.5 max-w-[470px] text-[14.5px] leading-[1.65] text-neutral-500">
          {text}
        </p>
        <div className="mt-[52px]">
          <TextLink>View docs</TextLink>
        </div>
      </div>
    </article>
  );
}

function Workflows() {
  return (
    <Bleed id="workflows" className="scroll-mt-24">
      <Col className="py-3 sm:py-4">
        <div className="grid gap-3 sm:gap-[23px] lg:grid-cols-2">
          <WorkflowCard
            visual={<OrbitVisual />}
            tag={{ icon: Repeat, label: "Looping interface" }}
            title="AI-powered medical workflows"
            text="These workflows streamline complex hospital processes — from patient registration and appointment scheduling to clinical follow-up."
          />
          <WorkflowCard
            visual={<NetworkVisual />}
            tag={{ icon: Globe, label: "Up to date" }}
            title="Support evidence-based decision-making"
            text="Automated workflows in healthcare refer to the use of AI and digital systems to manage, execute, and optimize routine medical tasks."
          />
        </div>
      </Col>
    </Bleed>
  );
}

/* ============================================================
   ANALYTICS
============================================================ */

/* Barres décoratives : [hauteur 0–32, groupe]. */
const BAR_GROUPS: Array<{ opacity: number; bars: number[] }> = [
  { opacity: 1, bars: [18, 11, 25, 17, 12, 28, 24, 31, 15, 22] },
  { opacity: 0.5, bars: [14, 31, 27, 22, 29] },
  { opacity: 0.2, bars: [26, 19, 22, 15] },
  { opacity: 0.1, bars: [28, 14, 22, 12, 17] },
];

function ReportChart() {
  const pitch = 2.9;
  let cursor = 0;
  const gap = 4.6;

  return (
    <svg
      viewBox="0 0 116 34"
      role="img"
      aria-label="Bar chart comparing last year and this year"
      className="h-auto w-full"
    >
      {BAR_GROUPS.map((group, g) => {
        const start = cursor;
        cursor += group.bars.length * pitch + gap;
        return (
          <g key={g} fill="#0c0c0d" opacity={group.opacity}>
            {group.bars.map((h, i) => (
              <rect
                key={i}
                x={start + i * pitch}
                y={33 - h}
                width="1.35"
                height={h}
                rx="0.6"
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function Analytics() {
  return (
    <Bleed id="analytics" className="scroll-mt-24">
      <Col>
        <div className="px-5 pb-[34px] pt-[70px] sm:px-7 lg:pb-[34px] lg:pt-[88px]">
          <SectionTag>Book a Demo</SectionTag>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,44%)_minmax(0,56%)]">
          <div className="flex flex-col">
            <div className={["px-5 pb-6 pt-3 sm:px-[57px]", "border-b", HAIR].join(" ")}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-[20px] font-medium tracking-[-0.04em] text-[#0c0c0d]">
                  Mental Health Report
                </h3>
                <div className="flex items-center gap-4 text-[11px] text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#0c0c0d]" />
                    Last Year
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full border border-neutral-400" />
                    This Year
                  </span>
                  <Ellipsis className="h-4 w-4 text-neutral-900" aria-hidden="true" />
                </div>
              </div>

              <div className="mt-6 grid grid-cols-[34px_minmax(0,1fr)] gap-3">
                <div
                  aria-hidden="true"
                  className="flex flex-col justify-between pb-1 pt-1 text-[9px] tabular-nums text-neutral-400"
                >
                  <span>100</span>
                  <span>75</span>
                  <span>50</span>
                  <span>25</span>
                </div>
                <div>
                  <div className="mb-3 flex flex-wrap gap-x-10 gap-y-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0c0c0d] shadow-[0_6px_12px_-6px_rgba(0,0,0,0.5)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      </span>
                      <div className="leading-tight">
                        <p className="text-[9px] text-neutral-400">Total Score</p>
                        <p className="text-[9px] text-neutral-300">82/100</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.07),0_4px_10px_-4px_rgba(0,0,0,0.15)]">
                        <span className="h-1 w-1 rounded-full bg-[#0c0c0d]" />
                      </span>
                      <div className="leading-tight">
                        <p className="text-[9px] text-neutral-400">Last Week</p>
                        <p className="text-[9px] text-neutral-300">68/100 · +4 improvement</p>
                      </div>
                    </div>
                  </div>
                  <ReportChart />
                </div>
              </div>
            </div>

            <div className="flex flex-1 flex-col px-5 pb-8 pt-9 sm:px-[57px] lg:pb-0">
              <MiniTag icon={ChartColumn} label="AI Analytic" />
              <h3 className="mt-[22px] text-[clamp(22px,2vw,28px)] font-medium leading-tight tracking-[-0.04em] text-[#0c0c0d]">
                AI analyzes your condition
              </h3>
              <p className="mt-3.5 max-w-[470px] text-[14.5px] leading-[1.65] text-neutral-500">
                A hospital uses an AI-driven workflow to automatically route lab
                results to the right physician and update the patient’s EHR.
              </p>
              <div className="mt-11">
                <TextLink>View docs</TextLink>
              </div>
            </div>
          </div>

          <div className="relative min-h-[360px] bg-[#f5f5f5] sm:min-h-[440px] lg:min-h-[580px]">
            <img
              src={IMG.analyticsPortrait}
              alt="Black and white profile portrait of a man looking upward"
              width={1024}
              height={804}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover object-[60%_50%]"
            />
          </div>
        </div>

        <div className="h-[56px] lg:h-[90px]" />
      </Col>
    </Bleed>
  );
}

/* ============================================================
   FAQ
============================================================ */

function Faq() {
  return (
    <Bleed id="faq" className="scroll-mt-24">
      <Col>
        <div className="px-5 pb-12 pt-[56px] text-center sm:px-7 lg:pb-[58px] lg:pt-[62px]">
          <SectionTag>FAQs</SectionTag>
          <h2 className="mt-5 text-[clamp(34px,4vw,56px)] font-medium leading-[1.05] tracking-[-0.05em] text-[#0c0c0d]">
            Curious About Something?
          </h2>
        </div>

        <div className="grid lg:grid-cols-2">
          <div className="relative min-h-[300px] overflow-hidden sm:min-h-[420px] lg:min-h-[620px]">
            <img
              src={IMG.hands}
              alt="A robotic hand reaching toward a human hand"
              width={760}
              height={800}
              loading="lazy"
              decoding="async"
              className="absolute left-[8%] top-[4%] w-[78%] max-w-[520px] mix-blend-multiply"
            />
          </div>

          <div className={["flex items-start px-5 pb-12 sm:px-7 lg:items-center lg:border-l lg:px-[36px] lg:py-0", HAIR].join(" ")}>
            <ol
              className={[
                "w-full overflow-hidden rounded-[22px] border",
                HAIR,
              ].join(" ")}
            >
              {FAQS.map((question, index) => (
                <li
                  key={question}
                  className={[
                    "flex min-h-[76px] items-center px-6 text-[17px] tracking-[-0.025em] text-neutral-600 transition-colors duration-200 hover:bg-neutral-50 hover:text-neutral-900 sm:px-10 lg:min-h-[109px]",
                    index > 0 ? `border-t ${HAIR}` : "",
                  ].join(" ")}
                >
                  <span className="mr-2 tabular-nums">{index + 1}.</span>
                  {question}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Col>
    </Bleed>
  );
}

/* ============================================================
   CTA
============================================================ */

function CallToAction() {
  return (
    <Bleed>
      <Col>
        <div className="grid lg:grid-cols-[22%_56%_22%]">
          <div className={["relative hidden lg:block", ""].join(" ")}>
            <DotField
              className="inset-[14%_12%]"
              mask="radial-gradient(closest-side, #000 10%, transparent 100%)"
              strength={0.12}
            />
          </div>
          <div className={["flex flex-col items-center px-6 py-14 text-center lg:border-x lg:py-[54px]", HAIR].join(" ")}>
            <p className="max-w-[580px] text-[clamp(16px,1.35vw,19px)] leading-[1.55] tracking-[-0.02em] text-neutral-500">
              Our AI is trained with verified medical data and provides highly
              accurate symptom analysis
            </p>
            <a
              href="/faq"
              className={[
                "mt-7 inline-flex h-14 items-center rounded-full px-10 text-[13.5px] font-medium tracking-[-0.01em]",
                BTN_DARK,
                FOCUS,
              ].join(" ")}
            >
              Ask questions
            </a>
          </div>
          <div className="relative hidden lg:block">
            <DotField
              className="inset-[14%_12%]"
              mask="radial-gradient(closest-side, #000 10%, transparent 100%)"
              strength={0.12}
            />
          </div>
        </div>
      </Col>
    </Bleed>
  );
}

/* ============================================================
   FOOTER
============================================================ */

function FooterLink({ label, href }: { label: string; href?: string }) {
  const cls = "text-[14px] tracking-[-0.01em] text-neutral-400";
  return href ? (
    <a
      href={href}
      className={[
        cls,
        "rounded transition-colors duration-200 hover:text-neutral-900",
        FOCUS,
      ].join(" ")}
    >
      {label}
    </a>
  ) : (
    <span className={cls}>{label}</span>
  );
}

function SiteFooter() {
  const [email, setEmail] = useState("");

  return (
    <footer>
      <Col>
        <div className="grid gap-12 px-5 pb-[72px] pt-[56px] sm:px-7 lg:grid-cols-[1.75fr_1.08fr_0.95fr_1fr] lg:gap-0 lg:pb-[150px]">
          <div>
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection("top");
              }}
              aria-label="Stone — back to top"
              className={["inline-flex items-center gap-2 rounded-md", FOCUS].join(" ")}
            >
              <StoneLogoMark />
              <span className="text-[21px] font-medium tracking-[-0.04em]">
                Stone
              </span>
            </a>

            <h2 className="mt-7 text-[21px] font-medium tracking-[-0.035em] text-[#0c0c0d]">
              Subscribe newsletter
            </h2>
            <form
              className="mt-5 flex max-w-[358px] items-center rounded-full p-1 shadow-[0_0_0_1px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] focus-within:shadow-[0_0_0_1px_rgba(0,0,0,0.25),0_1px_2px_rgba(0,0,0,0.04)]"
              onSubmit={(e) => {
                e.preventDefault();
                if (email.trim()) setEmail("");
              }}
            >
              <label htmlFor="landing-newsletter" className="sr-only">
                Email address
              </label>
              <input
                id="landing-newsletter"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="min-w-0 flex-1 bg-transparent px-4 text-[13px] text-neutral-900 outline-none placeholder:text-neutral-400"
              />
              <button
                type="submit"
                className={[
                  "h-[42px] shrink-0 rounded-full px-6 text-[13px] font-medium",
                  BTN_DARK,
                  FOCUS,
                ].join(" ")}
              >
                Subscribe
              </button>
            </form>
          </div>

          {FOOTER_COLUMNS.map((column, index) => (
            <nav key={`${column.title}-${index}`} aria-label={column.title}>
              <h2 className="text-[18px] font-medium tracking-[-0.035em] text-[#0c0c0d]">
                {column.title}
              </h2>
              <ul className="mt-6 flex flex-col gap-[22px]">
                {column.links.map((link, i) => (
                  <li key={`${link.label}-${i}`}>
                    <FooterLink label={link.label} href={link.href} />
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div
          className={[
            "relative grid grid-cols-1 items-center gap-2 border-y px-5 py-4 text-center text-[13px] text-neutral-400 sm:px-7 lg:h-[44px] lg:grid-cols-3 lg:gap-0 lg:px-[88px] lg:py-0",
            HAIR,
          ].join(" ")}
        >
          <a
            href="/privacy"
            className={["justify-self-center rounded transition-colors hover:text-neutral-900 lg:justify-self-start", FOCUS].join(" ")}
          >
            Privacy policy
          </a>
          <span className="relative z-10 justify-self-center">
            All Rights Reserved 2026
          </span>
          <a
            href="/tos"
            className={["justify-self-center rounded transition-colors hover:text-neutral-900 lg:justify-self-end", FOCUS].join(" ")}
          >
            Terms of use
          </a>

          <svg
            aria-hidden="true"
            viewBox="0 0 411 44"
            className="pointer-events-none absolute left-1/2 top-0 hidden h-[44px] w-[411px] -translate-x-1/2 lg:block"
            fill="none"
            stroke="rgba(0,0,0,0.075)"
          >
            <path d="M71 0 L0 44" />
            <path d="M340 0 L411 44" />
          </svg>
        </div>
        <div className="h-8" />
      </Col>
    </footer>
  );
}

/* ============================================================
   PAGE
============================================================ */

export default function Landing() {
  return (
    <div
      id="top"
      className="min-h-screen bg-white font-display text-[#0c0c0d] antialiased selection:bg-[#0c0c0d] selection:text-white"
    >
      <Header />
      {/* La barre est en position fixe : on réserve sa hauteur. */}
      <div aria-hidden="true" className="h-[73px] lg:h-[91px]" />
      <main>
        <Hero />
        <TrustedBy />
        <Interlude />
        <Features />
        <Workflows />
        <Analytics />
        <Faq />
        <CallToAction />
      </main>
      <SiteFooter />
    </div>
  );
}
