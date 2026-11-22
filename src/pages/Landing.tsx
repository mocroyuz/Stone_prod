import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
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
import { useLandingMotion } from "../hooks/useLandingMotion";

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

/* Les ombres gardent le même nombre de couches entre repos et survol :
   c'est ce qui permet au navigateur de les interpoler proprement. */
const PRESS =
  "transition-[background-color,box-shadow,translate,scale] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-px active:translate-y-px active:scale-[0.985]";

const BTN_DARK =
  "bg-[#0c0c0d] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_2px_rgba(0,0,0,0.28),0_10px_22px_-10px_rgba(0,0,0,0.5)] hover:bg-[#1d1d20] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_4px_rgba(0,0,0,0.28),0_16px_28px_-10px_rgba(0,0,0,0.55)] " +
  PRESS;

const BTN_LIGHT =
  "bg-white text-neutral-900 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.05),0_8px_20px_-12px_rgba(0,0,0,0.18)] hover:shadow-[0_0_0_1px_rgba(0,0,0,0.09),0_2px_4px_rgba(0,0,0,0.06),0_14px_26px_-12px_rgba(0,0,0,0.22)] " +
  PRESS;

/** Délai d'apparition (ms) lu par le CSS via --reveal-delay. */
const d = (ms: number): CSSProperties =>
  ({ "--reveal-delay": `${ms}ms` }) as CSSProperties;

/** Délai + variables libres (index de cascade, durée de flottement…). */
const dv = (ms: number, vars: Record<string, string | number>): CSSProperties =>
  ({
    "--reveal-delay": `${ms}ms`,
    ...Object.fromEntries(Object.entries(vars).map(([k, v]) => [`--${k}`, v])),
  }) as CSSProperties;

const SOFT_CARD =
  "bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_2px_4px_rgba(0,0,0,0.03),0_16px_32px_-16px_rgba(0,0,0,0.14)]";

/** Colonne centrale (sans filets latéraux). */
function Col({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={["mx-auto w-full max-w-[1313px]", className].join(" ")}
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
        className="h-3.5 w-3.5 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-1"
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
      className="h-6 w-auto"
    />
  );
}

/* Défilement vers une ancre : courbe ease-in-out cubique, durée proportionnelle
   à la distance, interrompu dès que l'utilisateur reprend la main. */
let scrollFrame = 0;
let stopScroll: (() => void) | null = null;

function smoothScrollTo(targetY: number) {
  stopScroll?.();

  const root = document.documentElement;
  const to = Math.max(0, Math.min(targetY, root.scrollHeight - window.innerHeight));
  const from = window.scrollY;
  const distance = to - from;
  if (Math.abs(distance) < 2) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.scrollTo(0, to);
    return;
  }

  const duration = Math.min(1200, Math.max(600, Math.abs(distance) * 0.5));
  const previousBehavior = root.style.scrollBehavior;
  // Le CSS global met `scroll-behavior: smooth` : sans ça, chaque image du
  // tween serait elle-même lissée par le navigateur et on aurait du retard.
  root.style.scrollBehavior = "auto";

  const interrupts = ["wheel", "touchstart", "keydown", "mousedown"] as const;
  const finish = () => {
    cancelAnimationFrame(scrollFrame);
    root.style.scrollBehavior = previousBehavior;
    for (const type of interrupts) window.removeEventListener(type, finish);
    stopScroll = null;
  };
  stopScroll = finish;
  for (const type of interrupts) {
    window.addEventListener(type, finish, { passive: true });
  }

  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    window.scrollTo(0, from + distance * eased);
    if (t < 1) scrollFrame = requestAnimationFrame(step);
    else finish();
  };
  scrollFrame = requestAnimationFrame(step);
}

function scrollToSection(id: string) {
  if (id === "top") {
    smoothScrollTo(0);
    return;
  }
  const el = document.getElementById(id);
  if (!el) return;
  // On respecte le scroll-margin-top (scroll-mt-24) déjà posé sur les sections.
  const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  smoothScrollTo(el.getBoundingClientRect().top + window.scrollY - margin);
}

/* ============================================================
   HEADER
============================================================ */

const SPY_SECTIONS = ["features", "workflows", "analytics"];
const EASE_SOFT = "ease-[cubic-bezier(0.22,1,0.36,1)]";
const MENU_EXIT_MS = 300;

function Header() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("top");
  const [hovered, setHovered] = useState<number | null>(null);

  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);
  const pillPlaced = useRef(false);
  const closeTimer = useRef(0);

  /* Ombre / compaction du header + section courante (scroll-spy). */
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > 8);
      let current = "top";
      for (const id of SPY_SECTIONS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 160) current = id;
      }
      setActiveSection(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  /* Fermeture du menu mobile avec animation de sortie. */
  const closeMenu = useCallback(() => {
    if (!open || closing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOpen(false);
      return;
    }
    setClosing(true);
    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, MENU_EXIT_MS);
  }, [open, closing]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeMenu]);

  const go = (id: string) => {
    closeMenu();
    scrollToSection(id);
  };

  /* Pastille de navigation : glisse sous le lien survolé, sinon sous la
     section visible. Position écrite directement dans le DOM (pas de
     re-render), et la toute première pose se fait sans transition. */
  const activeIndex = NAV_LINKS.findIndex(
    (link) => "section" in link && link.section === activeSection,
  );
  const highlight = hovered ?? activeIndex;

  useEffect(() => {
    const place = () => {
      const pill = pillRef.current;
      const item = itemRefs.current[highlight];
      if (!pill || !item) return;
      const first = !pillPlaced.current;
      if (first) pill.style.transition = "none";
      pill.style.width = `${item.offsetWidth}px`;
      pill.style.transform = `translateX(${item.offsetLeft}px)`;
      if (first) {
        void pill.offsetWidth;
        pill.style.transition = "";
        pill.style.opacity = "1";
        pillPlaced.current = true;
      }
    };
    place();
    const nav = navRef.current;
    if (!nav || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(place);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [highlight]);

  return (
    <>
    <header
      className={[
        "header-in fixed inset-x-0 top-0 z-50 border-b backdrop-blur-xl backdrop-saturate-150 transition-[background-color,box-shadow] duration-500",
        EASE_SOFT,
        HAIR,
        scrolled
          ? "bg-white/80 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.25)]"
          : "bg-white/60 shadow-[0_10px_30px_-18px_rgba(0,0,0,0)]",
      ].join(" ")}
    >
      <Col
        className={[
          "relative flex h-[72px] max-w-[1800px] items-center justify-between px-8 transition-[height] duration-500 sm:px-12 lg:px-16",
          EASE_SOFT,
          scrolled ? "lg:h-[72px]" : "lg:h-[90px]",
        ].join(" ")}
      >
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            go("top");
          }}
          aria-label="Stone — home"
          className={["flex items-center gap-2 rounded-md", FOCUS].join(" ")}
        >          <StoneLogoMark />
          <span className="text-[20px] font-bold tracking-[-0.04em]">
            Stone
          </span>
        </a>

        <nav
          ref={navRef}
          aria-label="Main"
          onMouseLeave={() => setHovered(null)}
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-0.5 rounded-full p-1 shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.03)] md:flex"
        >
          <span
            ref={pillRef}
            aria-hidden="true"
            className={[
              "pointer-events-none absolute inset-y-1 left-0 w-0 rounded-full bg-[#0c0c0d] opacity-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_2px_6px_-1px_rgba(0,0,0,0.35)] transition-[transform,width] duration-500",
              EASE_SOFT,
            ].join(" ")}
          />
          {NAV_LINKS.map((link, index) => {
            const cls = [
              "relative z-10 rounded-full px-[18px] py-2 text-[13px] font-medium tracking-[-0.01em] transition-colors duration-300",
              FOCUS,
              index === highlight ? "text-white" : "text-neutral-400",
            ].join(" ");
            const hover = {
              onMouseEnter: () => setHovered(index),
              onFocus: (e: { currentTarget: HTMLElement }) => {
                if (e.currentTarget.matches(":focus-visible")) setHovered(index);
              },
              onBlur: () => setHovered(null),
            };
            return "href" in link ? (
              <a
                key={link.label}
                href={link.href}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                className={cls}
                {...hover}
              >
                {link.label}
              </a>
            ) : (
              <button
                key={link.label}
                type="button"
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                onClick={() => go(link.section)}
                className={cls}
                {...hover}
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
              "inline-flex h-12 items-center justify-center rounded-full bg-white px-7 text-[14px] font-semibold normal-case tracking-[-0.02em] text-[#111] shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_2px_4px_rgba(0,0,0,0.05),0_8px_20px_-12px_rgba(0,0,0,0.18)] hover:bg-neutral-100 hover:shadow-[0_0_0_1px_rgba(0,0,0,0.09),0_2px_4px_rgba(0,0,0,0.06),0_12px_24px_-12px_rgba(0,0,0,0.22)]",
              PRESS,
              FOCUS,
            ].join(" ")}
          >
            Get started
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
          </a>
          <button
            type="button"
            aria-label={open && !closing ? "Close menu" : "Open menu"}
            aria-expanded={open && !closing}
            aria-controls="landing-mobile-menu"
            onClick={() => (open ? closeMenu() : setOpen(true))}
            className={[
              "flex h-11 w-11 items-center justify-center rounded-full md:hidden",
              BTN_LIGHT,
              FOCUS,
            ].join(" ")}
          >
            {open && !closing ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </button>
        </div>

      </Col>
    </header>
    {open && (
      <div className="fixed inset-0 z-[60] md:hidden">
        <button
          type="button"
          aria-label="Close menu"
          onClick={closeMenu}
          data-state={closing ? "closing" : "open"}
          className="menu-backdrop absolute inset-0 bg-black/35 backdrop-blur-[2px]"
        />
        <MobileMenuSheet closing={closing} onClose={closeMenu} go={go} />
      </div>
    )}
  </>
  );
}

function MobileMenuSheet({
  closing,
  onClose,
  go,
}: {
  closing: boolean;
  onClose: () => void;
  go: (id: string) => void;
}) {
  const dragStartY = useRef<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleDragEnd = (endY: number) => {
    if (dragStartY.current === null) return;
    const delta = endY - dragStartY.current;
    if (delta > 75) onClose();
    else if (delta < -55) setExpanded(true);
    else if (delta > 30) setExpanded(false);
    dragStartY.current = null;
  };

  return (
    <div
      id="landing-mobile-menu"
      data-state={closing ? "closing" : "open"}
      className={[
        "menu-sheet absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-[28px] border border-black/[0.06] bg-white shadow-[0_-18px_60px_-20px_rgba(0,0,0,0.3)] transition-[height] duration-500",
        EASE_SOFT,
        expanded ? "h-[85dvh]" : "h-[50dvh]",
      ].join(" ")}
    >
      <div
        className="flex shrink-0 touch-none cursor-grab justify-center pb-3 pt-4 active:cursor-grabbing"
        onPointerDown={(event) => { dragStartY.current = event.clientY; }}
        onPointerUp={(event) => handleDragEnd(event.clientY)}
        onPointerCancel={() => { dragStartY.current = null; }}
      >
        <span className="h-1.5 w-10 rounded-full bg-neutral-300" />
      </div>
      <nav aria-label="Mobile navigation" className="min-h-0 flex-1 overflow-y-auto px-5 pb-8">
        {NAV_LINKS.map((link, index) =>
          "href" in link ? (
            <a
              key={link.label}
              href={link.href}
              style={{ "--i": index } as CSSProperties}
              className="menu-item block rounded-xl px-5 py-4 text-[17px] font-medium text-neutral-800 transition-colors duration-300 hover:bg-neutral-100"
            >
              {link.label}
            </a>
          ) : (
            <button
              key={link.label}
              type="button"
              onClick={() => go(link.section)}
              style={{ "--i": index } as CSSProperties}
              className="menu-item block w-full rounded-xl px-5 py-4 text-left text-[17px] font-medium text-neutral-800 transition-colors duration-300 hover:bg-neutral-100"
            >
              {link.label}
            </button>
          )
        )}
      </nav>
    </div>
  );
}

/* ============================================================
   HERO
============================================================ */

function Hero() {
  const nodes = [
    { icon: ClipboardList, x: "8%", y: "16%" },
    { icon: Camera, x: "18%", y: "36%" },
    { icon: ScanFace, x: "18%", y: "58%" },
    { icon: Ribbon, x: "8%", y: "80%" },
    { icon: Pill, x: "92%", y: "16%" },
    { icon: Syringe, x: "82%", y: "36%" },
    { icon: Scan, x: "82%", y: "58%" },
    { icon: Stethoscope, x: "92%", y: "80%" },
  ];
  const leftPaths = [
    "M 120 120 C 280 140, 350 285, 480 350",
    "M 220 260 C 330 280, 380 320, 480 350",
    "M 220 420 C 330 410, 380 380, 480 350",
    "M 120 560 C 280 540, 350 415, 480 350",
  ];
  const rightPaths = [
    "M 880 120 C 720 140, 650 285, 520 350",
    "M 780 260 C 670 280, 620 320, 520 350",
    "M 780 420 C 670 410, 620 380, 520 350",
    "M 880 560 C 720 540, 650 415, 520 350",
  ];
  const iconNodes = [ClipboardList, Camera, ScanFace, Ribbon, Pill, Syringe, Scan, Stethoscope];
  return (
    <Bleed id="top">
      <Col className="relative overflow-hidden">
        <div className="grid items-center gap-5 px-5 py-12 sm:px-7 lg:grid-cols-[minmax(0,38%)_minmax(0,62%)] lg:py-16">
          <div className="relative z-10">
            <div data-reveal="up" style={d(0)}>
              <Badge chip="Stone" label="Your social media, in one place" />
            </div>
            <h1 data-reveal="up" style={d(120)} className="mt-6 text-[clamp(40px,4.9vw,70px)] font-medium leading-[1.06] tracking-[-0.05em] text-[#0c0c0d]">
              <span className="block">Create once.</span>
              <span className="block">Publish everywhere.</span>
            </h1>
            <p data-reveal="up" style={d(280)} className="mt-6 max-w-[480px] text-[16.5px] leading-[1.7] tracking-[-0.01em] text-neutral-500">
              Plan, schedule and manage all your social channels from one simple workspace.
            </p>
            <div data-reveal="up" style={d(400)} className="mt-7 flex flex-wrap items-center gap-3">
              <a href="/signup" className={["inline-flex h-[54px] items-center rounded-full px-8 text-[12px] font-semibold uppercase tracking-[0.03em]", BTN_DARK, FOCUS].join(" ")}>
                Get started <ArrowRight className="ml-2 h-4 w-4" />
              </a>
              <a href="/signin" className={["inline-flex h-[54px] items-center rounded-full px-8 text-[12px] font-semibold uppercase tracking-[0.03em]", BTN_LIGHT, FOCUS].join(" ")}>
                Sign in
              </a>
            </div>
          </div>

          <div data-reveal="scale" style={d(180)} className="relative mx-auto aspect-[1000/700] w-full max-w-[760px]">
            <div className="absolute inset-[12%] rounded-full opacity-70" style={{backgroundImage:"radial-gradient(#d4d4d4 1.2px, transparent 1.2px)",backgroundSize:"15px 15px",maskImage:"radial-gradient(ellipse, black 0%, transparent 72%)"}} />
            <svg viewBox="0 0 1000 700" className="absolute inset-0 h-full w-full" aria-hidden="true">
              <defs>
                <marker id="stone-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto" markerUnits="strokeWidth">
                  <path d="M0,0 L8,4.5 L0,9" fill="none" stroke="#ef4444" strokeWidth="1.5" />
                </marker>
              </defs>
              {leftPaths.map((path,i)=><path key={"l"+i} d={path} fill="none" stroke="#ef4444" strokeWidth="2.8" strokeLinecap="round" markerEnd="url(#stone-arrow)" />)}
              {rightPaths.map((path,i)=><path key={"r"+i} d={path} fill="none" stroke="#ef4444" strokeWidth="2.8" strokeLinecap="round" markerEnd="url(#stone-arrow)" />)}
            </svg>
            {iconNodes.map((Icon,i)=>{
              const positions = [
                ["8%","16%"],["18%","36%"],["18%","58%"],["8%","80%"],
                ["92%","16%"],["82%","36%"],["82%","58%"],["92%","80%"],
              ];
              return <div key={i} className="absolute z-10 flex h-[clamp(48px,6.5vw,76px)] w-[clamp(48px,6.5vw,76px)] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-black/[0.06] bg-white text-neutral-600 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.22)]" style={{left:positions[i][0],top:positions[i][1]}}><Icon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.7}/></div>
            })}
            <div className="absolute left-1/2 top-1/2 z-20 flex h-[clamp(68px,9vw,94px)] w-[clamp(145px,19vw,190px)] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-4 rounded-full bg-[#0c0c0d] text-white shadow-[0_12px_36px_-12px_rgba(0,0,0,0.35)]">
              <span className="text-white/50">‹</span><span className="text-[17px] font-medium tracking-tight">Stone</span><span className="text-white/50">›</span>
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
            <p
              data-reveal="up"
              className="max-w-[140px] text-[14px] leading-[1.35] tracking-[-0.02em] text-neutral-700"
            >
              Trusted by medical teams and hospitals
            </p>
          </div>
          {PARTNERS.map((partner, index) => (
            <div
              key={partner.key}
              className={[
                "flex h-[110px] items-center justify-center border-l text-[#0c0c0d] transition-colors duration-500 hover:bg-neutral-50/80 lg:h-[200px]",
                HAIR,
              ].join(" ")}
            >
              <div data-reveal="up" style={d(index * 70)}>
                {partner.node}
              </div>
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
          {/* La fleur tourne avec le scroll (lissé) en plus de sa lente rotation propre. */}
          <span
            data-reveal="scale"
            data-scroll-rotate="0.12"
            className="relative flex"
          >
            <PetalSpinner className="h-[60px] w-[60px] animate-[spin_60s_linear_infinite] text-[#0c0c0d] motion-reduce:animate-none lg:h-[84px] lg:w-[84px]" />
          </span>
        </div>
        <div
          data-reveal="fade"
          style={d(150)}
          className="flex h-[88px] items-center justify-center gap-4 text-[11px] font-medium uppercase tracking-[0.08em] tabular-nums lg:h-[125px]"
        >
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
          <div data-reveal="up">
            <Badge chip="AI" label="AI Support" />
          </div>
          <h2
            data-reveal="up"
            style={d(100)}
            className="mt-6 text-[clamp(34px,4vw,56px)] font-medium leading-[1.05] tracking-[-0.05em] text-[#0c0c0d]"
          >
            AI-powered healthcare support.
          </h2>
          <p
            data-reveal="up"
            style={d(320)}
            className="mx-auto mt-5 max-w-[560px] text-[15px] leading-[1.7] tracking-[-0.01em] text-neutral-500"
          >
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
                <div data-reveal="up" style={d(index * 120)}>
                <div
                  tabIndex={0}
                  className={[
                    "flex min-h-[300px] flex-col items-center rounded-[26px] px-8 pt-[62px] text-center outline-none transition-[translate,background-color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:min-h-[300px]",
                    isActive
                      ? "-translate-y-1.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_4px_8px_rgba(0,0,0,0.04),0_28px_48px_-20px_rgba(0,0,0,0.2)]"
                      : "translate-y-0 bg-white/0 shadow-[0_0_0_1px_rgba(0,0,0,0),0_4px_8px_rgba(0,0,0,0),0_28px_48px_-20px_rgba(0,0,0,0)]",
                  ].join(" ")}
                >
                  <Icon
                    className={[
                      "h-7 w-7 transition-[transform,color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                      isActive ? "scale-110 text-neutral-900" : "text-neutral-700",
                    ].join(" ")}
                    strokeWidth={1.3}
                    aria-hidden="true"
                  />
                  <h3 className="mt-[34px] text-[21px] font-medium leading-tight tracking-[-0.035em] text-[#0c0c0d]">
                    {title}
                  </h3>
                  <p className="mt-3.5 max-w-[290px] text-[13.5px] leading-[1.65] text-neutral-500">                    {text}
                  </p>
                </div>
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
    "float-soft absolute flex h-[68px] w-[68px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-neutral-800 shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_2px_4px_rgba(0,0,0,0.04),0_14px_28px_-12px_rgba(0,0,0,0.18)] sm:h-[84px] sm:w-[84px]";
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
        data-reveal="scale"
        style={d(0)}
        className="absolute left-1/2 top-1/2 h-[290px] w-[290px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/[0.045]"
      />

      <span data-reveal="fade" style={{ ...d(500), left: "30%", top: "32%" }} className={dot} />
      <span data-reveal="fade" style={{ ...d(580), left: "69%", top: "32%" }} className={dot} />
      <span data-reveal="fade" style={{ ...d(660), left: "50%", top: "83%" }} className={dot} />

      <span
        data-reveal="pop"
        style={{ ...dv(200, { "float-dur": "7s", "float-delay": "1.4s" }), left: "50%", top: "17%" }}
        className={bubble}
      >
        <Microscope className="h-[22px] w-[22px]" strokeWidth={1.4} />
      </span>
      <span
        data-reveal="pop"
        style={{ ...dv(340, { "float-dur": "8.5s", "float-delay": "2s" }), left: "28%", top: "61%" }}
        className={bubble}
      >
        <Brain className="h-[22px] w-[22px]" strokeWidth={1.4} />
      </span>
      <span
        data-reveal="pop"
        style={{ ...dv(480, { "float-dur": "7.5s", "float-delay": "2.6s" }), left: "71%", top: "61%" }}
        className={bubble}
      >
        <Flower className="h-[22px] w-[22px]" strokeWidth={1.4} />
      </span>

      <span
        data-reveal="pop"
        style={d(0)}
        className="absolute left-1/2 top-1/2 flex h-[50px] w-[50px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#0c0c0d] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_20px_-8px_rgba(0,0,0,0.5)]"
      >
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
        data-reveal="fade"
        style={d(250)}
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

      {side.map(({ icon: Icon, x, y }, index) => (
        <span
          key={`${x}-${y}`}
          data-reveal="pop"
          className="float-soft absolute flex h-[46px] w-[46px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-neutral-700 shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_2px_4px_rgba(0,0,0,0.04),0_10px_20px_-10px_rgba(0,0,0,0.16)] sm:h-[52px] sm:w-[52px]"
          style={{
            ...dv(300 + index * 70, {
              "float-dur": `${6.5 + (index % 4) * 0.8}s`,
              "float-delay": `${1.6 + index * 0.35}s`,
            }),
            left: `${x}%`,
            top: `${y}%`,
          }}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.4} />
        </span>
      ))}

      <span
        data-reveal="fade"
        className="absolute h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0c0c0d]"
        style={{ ...d(700), left: "37%", top: "50%" }}
      />
      <span
        data-reveal="fade"
        className="absolute h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0c0c0d]"
        style={{ ...d(700), left: "63%", top: "50%" }}
      />
      <span data-reveal="pop" style={d(100)} className="absolute left-1/2 top-1/2 flex h-[54px] -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-[#0c0c0d] px-6 text-[14px] font-medium tracking-[-0.02em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_14px_28px_-10px_rgba(0,0,0,0.55)]">
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
  delay = 0,
}: {
  visual: ReactNode;
  tag: { icon: LucideIcon; label: string };
  title: string;
  text: string;
  delay?: number;
}) {
  return (
    <article data-reveal="up" style={d(delay)} className="flex flex-col bg-white">
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
            delay={140}
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
  let order = 0;
  const gap = 4.6;

  return (
    <svg
      viewBox="0 0 116 34"
      role="img"
      aria-label="Bar chart comparing last year and this year"
      data-reveal="chart"
      style={d(200)}
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
                className="bar"
                style={{ "--i": order++ } as CSSProperties}
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
          <div data-reveal="up">
            <SectionTag>Book a Demo</SectionTag>
          </div>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,44%)_minmax(0,56%)]">
          <div className="flex flex-col">
            <div className={["px-5 pb-6 pt-3 sm:px-[57px]", "border-b", HAIR].join(" ")}>
              <div
                data-reveal="up"
                style={d(80)}
                className="flex flex-wrap items-center justify-between gap-3"
              >
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

              <div
                data-reveal="up"
                style={d(200)}
                className="mt-6 grid grid-cols-[34px_minmax(0,1fr)] gap-3"
              >
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
              <div data-reveal="rise">
                <MiniTag icon={ChartColumn} label="AI Analytic" />
              </div>
              <h3
                data-reveal="up"
                style={d(100)}
                className="mt-[22px] text-[clamp(22px,2vw,28px)] font-medium leading-tight tracking-[-0.04em] text-[#0c0c0d]"
              >
                AI analyzes your condition
              </h3>
              <p
                data-reveal="up"
                style={d(200)}
                className="mt-3.5 max-w-[470px] text-[14.5px] leading-[1.65] text-neutral-500"
              >
                A hospital uses an AI-driven workflow to automatically route lab
                results to the right physician and update the patient’s EHR.
              </p>
              <div data-reveal="up" style={d(300)} className="mt-11">
                <TextLink>View docs</TextLink>
              </div>
            </div>
          </div>

          <div
            data-reveal="fade"
            style={d(150)}
            className="relative min-h-[360px] sm:min-h-[440px] lg:min-h-[580px]"
          >
            <div className="absolute inset-0 bg-[#f5f5f5]">
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
          <div data-reveal="up">
            <SectionTag>FAQs</SectionTag>
          </div>
          <h2
            data-reveal="up"
            style={d(100)}
            className="mt-5 text-[clamp(34px,4vw,56px)] font-medium leading-[1.05] tracking-[-0.05em] text-[#0c0c0d]"
          >
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
              loading="lazy"              decoding="async"
              data-reveal="image"
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
                  data-reveal="rise"
                  style={d(index * 90)}
                  className={index > 0 ? `border-t ${HAIR}` : ""}
                >
                  <div className="group flex min-h-[76px] items-center px-6 text-[17px] tracking-[-0.025em] text-neutral-600 transition-colors duration-300 hover:bg-neutral-50 hover:text-neutral-900 sm:px-10 lg:min-h-[109px]">
                    <span className="mr-2 tabular-nums">{index + 1}.</span>
                    <span className="transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-1">
                      {question}
                    </span>
                  </div>
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
            <p
              data-reveal="up"
              className="max-w-[580px] text-[clamp(16px,1.35vw,19px)] leading-[1.55] tracking-[-0.02em] text-neutral-500"
            >
              Our AI is trained with verified medical data and provides highly
              accurate symptom analysis
            </p>
            <div data-reveal="up" style={d(140)} className="mt-7">
              <a
                href="/faq"
                className={[
                  "inline-flex h-14 items-center rounded-full px-10 text-[13.5px] font-medium tracking-[-0.01em]",
                  BTN_DARK,
                  FOCUS,
                ].join(" ")}
              >
                Ask questions
              </a>
            </div>
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
        "rounded transition-colors duration-300 hover:text-neutral-900",
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
        <div className="grid gap-12 px-5 pb-[72px] pt-[56px] sm:px-7 lg:grid-cols-[1.55fr_1fr_1fr_1fr] lg:gap-0 lg:px-12 lg:pb-[112px] lg:pt-[72px]">
          <div data-reveal="up">
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
            <nav
              key={`${column.title}-${index}`}
              aria-label={column.title}
              data-reveal="up"
              style={d(110 * (index + 1))}
              className="lg:border-l lg:border-black/[0.075] lg:pl-10"
            >
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
  const rootRef = useRef<HTMLDivElement>(null);
  useLandingMotion(rootRef);

  return (
    <div
      ref={rootRef}
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
      {/* Voile blanc : halo permanent + version d'arrivée qui se retire. */}
      <div aria-hidden="true" data-bottom-glow className="bottom-glow" />
      <div aria-hidden="true" className="bottom-glow-intro" />
    </div>
  );
}