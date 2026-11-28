import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  ArrowUpRight,
  CalendarDays,
  ChartColumn,
  Check,
  Lightbulb,
  Menu,
  PenLine,
  Share2,
  X,
  type LucideIcon,
} from "lucide-react";
import { DotField } from "../components/landing/LandingGraphics";
import { useLandingMotion } from "../hooks/useLandingMotion";
import { CHANNELS } from "../data/channelConfig";
import {
  CTA_LABEL,
  FEATURES_COPY,
  FINAL_CTA_COPY,
  FOOTER_COPY,
  HERO_VARIANTS,
  HOW_COPY,
  INSIGHTS_COPY,
  NAV_LINKS,
  NETWORKS_COPY,
  PROBLEMS_COPY,
  SIGNIN_HREF,
  SIGNUP_HREF,
  SPY_SECTIONS,
  resolveHeroVariant,
  type HeroVariant,
  type HeroVariantKey,
} from "../data/landingCopy";
import { rememberAttribution, track } from "../utils/analytics";
import {
  SiBluesky,
  SiFacebook,
  SiInstagram,
  SiMastodon,
  SiPinterest,
  SiReddit,
  SiThreads,
  SiTiktok,
  SiX,
  SiYoutubeshorts,
} from "@icons-pack/react-simple-icons";

/* ============================================================
   CONTENU
   Les textes vivent dans src/data/landingCopy.ts.
============================================================ */

const IMG = {
  stoneMark: "/images/landing/stone-mark.png",
};

/** Réseaux réellement disponibles / encore en développement (source : channelConfig). */
const LIVE_CHANNELS = CHANNELS.filter((channel) => !channel.comingSoon);
const SOON_CHANNELS = CHANNELS.filter((channel) => channel.comingSoon);

/**
 * Logos monochromes embarqués (aucune requête réseau, palette noir et blanc).
 * LinkedIn et Google Business Profile n'existent pas dans cette bibliothèque :
 * on retombe sur l'icône du projet, passée en niveaux de gris.
 */
type LogoComponent = ComponentType<{ className?: string; color?: string }>;

const SI_LOGOS: Partial<Record<string, LogoComponent>> = {
  instagram: SiInstagram,
  facebook: SiFacebook,
  threads: SiThreads,
  youtube: SiYoutubeshorts,
  tiktok: SiTiktok,
  pinterest: SiPinterest,
  x: SiX,
  bluesky: SiBluesky,
  mastodon: SiMastodon,
  reddit: SiReddit,
};

function NetworkLogo({
  channel,
  className = "h-6 w-6",
}: {
  channel: (typeof CHANNELS)[number];
  className?: string;
}) {
  const Logo = SI_LOGOS[channel.key];
  if (Logo) {
    return <Logo className={className} color="currentColor" aria-hidden="true" />;
  }
  const Fallback = channel.icon;
  return <Fallback className={[className, "grayscale"].join(" ")} />;
}

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
      <span className="shrink-0 whitespace-nowrap rounded-full bg-[#f7cfcf] px-2.5 py-[3px] text-[10px] font-semibold uppercase tracking-[0.04em] text-[#9b3a3a] shadow-[inset_0_0_0_1px_rgba(155,58,58,0.12)]">
        {chip}
      </span>
      {label}
    </span>
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
  const activeIndex = NAV_LINKS.findIndex((link) => link.section === activeSection);
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
          ? "bg-white/65 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.18)]"
          : "bg-white/35 shadow-[0_10px_30px_-18px_rgba(0,0,0,0)]",
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
          aria-label="Stone — accueil"
          className={["flex items-center gap-2 rounded-md", FOCUS].join(" ")}
        >          <StoneLogoMark />
          <span className="text-[20px] font-bold tracking-[-0.04em]">
            Stone
          </span>
        </a>

        <nav
          ref={navRef}
          aria-label="Navigation principale"
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
            return (
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
            href={SIGNIN_HREF}
            className={[
              "hidden h-12 items-center rounded-full px-4 text-[14px] font-medium tracking-[-0.02em] text-neutral-600 transition-colors duration-300 hover:text-neutral-900 sm:inline-flex",
              FOCUS,
            ].join(" ")}
          >
            Se connecter
          </a>
          <a
            href={SIGNUP_HREF}
            onClick={() => track("cta_click", { location: "header" })}
            className={[
              "inline-flex h-11 items-center justify-center whitespace-nowrap rounded-full bg-white px-5 text-[13.5px] sm:h-12 sm:px-7 sm:text-[14px] font-semibold text-[14px] font-semibold normal-case tracking-[-0.02em] text-[#111] shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_2px_4px_rgba(0,0,0,0.05),0_8px_20px_-12px_rgba(0,0,0,0.18)] hover:bg-neutral-100 hover:shadow-[0_0_0_1px_rgba(0,0,0,0.09),0_2px_4px_rgba(0,0,0,0.06),0_12px_24px_-12px_rgba(0,0,0,0.22)]",
              PRESS,
              FOCUS,
            ].join(" ")}
          >
            {CTA_LABEL}
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
          </a>
          <button
            type="button"
            aria-label={open && !closing ? "Fermer le menu" : "Ouvrir le menu"}
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
          aria-label="Fermer le menu"
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
      <nav aria-label="Navigation mobile" className="min-h-0 flex-1 overflow-y-auto px-5 pb-8">
        {NAV_LINKS.map((link, index) => (
            <button
              key={link.label}
              type="button"
              onClick={() => go(link.section)}
              style={{ "--i": index } as CSSProperties}
              className="menu-item block w-full rounded-xl px-5 py-4 text-left text-[17px] font-medium text-neutral-800 transition-colors duration-300 hover:bg-neutral-100"
            >
              {link.label}
            </button>
        ))}
        <div className="mt-4 flex flex-col gap-3 px-1">
          <SignupButton location="mobile_menu" className="w-full" />
          <a
            href={SIGNIN_HREF}
            className="block rounded-xl px-5 py-3 text-center text-[15px] font-medium text-neutral-700 transition-colors duration-300 hover:bg-neutral-100"
          >
            Se connecter
          </a>
        </div>
      </nav>
    </div>
  );
}

/* ============================================================
   CTA PRINCIPAL (toujours /signup, toujours le même libellé)
============================================================ */

function SignupButton({
  location,
  className = "",
}: {
  location: string;
  className?: string;
}) {
  return (
    <a
      href={SIGNUP_HREF}
      onClick={() => track("cta_click", { location })}
      className={[
        "inline-flex h-[54px] items-center justify-center gap-2 rounded-full px-8 text-[15px] font-semibold tracking-[-0.02em]",
        BTN_DARK,
        FOCUS,
        className,
      ].join(" ")}
    >
      {CTA_LABEL}
      <ArrowUpRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
    </a>
  );
}

/* ============================================================
   HERO
============================================================ */

const HERO_MASK =
  "linear-gradient(to bottom, #000 0%, #000 68%, rgba(0,0,0,0.98) 75%, rgba(0,0,0,0.91) 82%, rgba(0,0,0,0.76) 88%, rgba(0,0,0,0.52) 93%, rgba(0,0,0,0.25) 97%, transparent 100%)";

function Hero({ variant }: { variant: HeroVariant }) {
  return (
    <Bleed>
      <Col className="relative overflow-hidden">
        <div className="relative grid grid-cols-1 items-center lg:grid-cols-[minmax(0,48%)_minmax(0,52%)]">
          <div className="relative z-10 px-5 pb-6 pt-10 sm:px-7 lg:py-[88px]">
            <div data-reveal="up" style={d(0)}>
              <Badge chip={variant.chip} label={variant.eyebrow} />
            </div>

            <h1
              data-reveal="up"
              style={d(120)}
              className="mt-6 text-[clamp(36px,4.3vw,62px)] font-medium leading-[1.06] tracking-[-0.05em] text-[#0c0c0d]"
            >
              <span className="block lg:whitespace-nowrap">{variant.titleLines[0]}</span>
              <span className="block lg:whitespace-nowrap">{variant.titleLines[1]}</span>
            </h1>

            <p
              data-reveal="up"
              style={d(380)}
              className="mt-6 max-w-[500px] text-[16.5px] leading-[1.7] tracking-[-0.01em] text-neutral-500"
            >
              {variant.subtitle}
            </p>

            <div
              data-reveal="up"
              style={d(500)}
              className="mt-7 flex flex-col items-start gap-4"
            >
              <SignupButton location="hero" className="w-full sm:w-auto" />
              <p className="text-[13.5px] text-neutral-500">
                Déjà un compte ?{" "}
                <a
                  href={SIGNIN_HREF}
                  className={[
                    "rounded font-medium text-neutral-900 underline underline-offset-4",
                    FOCUS,
                  ].join(" ")}
                >
                  Se connecter
                </a>
              </p>
            </div>
          </div>

          <div
            data-reveal="image"
            data-parallax="0.04"
            style={d(150)}
            className="relative flex w-full items-center justify-center pl-0 pr-0 pb-4 sm:pl-0 lg:py-4 lg:ml-12"
          >
            <picture>
              <source
                type="image/webp"
                srcSet="/images/hero-1200.webp 1200w, /images/hero-1800.webp 1800w"
                sizes="(min-width: 1024px) 62vw, 100vw"
              />
              <img
                src="/images/hero.jpg"
                alt="Aperçu de Stone : des publications préparées pour plusieurs réseaux sociaux, affichées sur un téléphone"
                width={2752}
                height={1536}
                fetchPriority="high"
                decoding="async"
                className="hero-float relative z-10 h-auto w-full max-w-[860px] scale-[1.1] rounded-2xl object-contain shadow-[0_28px_70px_-28px_rgba(0,0,0,0.28)] lg:max-w-none lg:w-[125%]"
                style={{ WebkitMaskImage: HERO_MASK, maskImage: HERO_MASK }}
              />
            </picture>
          </div>
        </div>
      </Col>
    </Bleed>
  );
}

/* ============================================================
   RÉSEAUX COMPATIBLES
============================================================ */

function Networks() {
  return (
    <Bleed id="networks" className="scroll-mt-24">
      <Col>
        <div className="grid lg:grid-cols-[minmax(0,32%)_minmax(0,68%)]">
          <div className="flex flex-col justify-center px-5 py-9 sm:px-7 lg:px-10 lg:py-0">
            <h2
              data-reveal="up"
              className="text-[clamp(20px,2vw,26px)] font-medium leading-tight tracking-[-0.04em] text-[#0c0c0d]"
            >
              {NETWORKS_COPY.title}
            </h2>
            <p
              data-reveal="up"
              style={d(100)}
              className="mt-3 max-w-[360px] text-[14px] leading-[1.6] text-neutral-500"
            >
              {NETWORKS_COPY.text}
            </p>
          </div>

          <div className={["border-t lg:border-l lg:border-t-0", HAIR].join(" ")}>
            <p className="px-5 pb-1 pt-4 text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-400 sm:px-7">
              {NETWORKS_COPY.available}
            </p>
            <ul className="grid grid-cols-3 sm:grid-cols-6">
              {LIVE_CHANNELS.map((channel, index) => (
                <li
                  key={channel.key}
                  className={[
                    "flex h-[104px] flex-col items-center justify-center gap-2.5 border-t px-2 text-center transition-colors duration-500 hover:bg-neutral-50/80 lg:h-[128px]",
                    HAIR,
                    "border-l",
                    index % 3 === 0 ? "max-sm:border-l-0" : "",
                    index === 0 ? "sm:border-l-0" : "",
                  ].join(" ")}
                >
                  <div data-reveal="up" style={d(index * 70)} className="flex flex-col items-center gap-2.5">
                    <NetworkLogo channel={channel} className="h-7 w-7 text-[#0c0c0d]" />
                    <span className="text-[12.5px] font-medium tracking-[-0.01em] text-neutral-800">
                      {channel.name}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <div
              className={[
                "flex flex-wrap items-center gap-x-5 gap-y-2.5 border-t px-5 py-4 sm:px-7",
                HAIR,
              ].join(" ")}
            >
              <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-400">
                {NETWORKS_COPY.soon}
              </span>
              <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {SOON_CHANNELS.map((channel) => (
                  <li key={channel.key} className="flex items-center gap-1.5 text-[12.5px] text-neutral-500">
                    <NetworkLogo channel={channel} className="h-4 w-4 text-neutral-400" />
                    {channel.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Col>
    </Bleed>
  );
}

/* ============================================================
   PROBLÈMES → BÉNÉFICES
============================================================ */

function Problems() {
  return (
    <Bleed id="problems" className="scroll-mt-24">
      <Col>
        <div className={["border-b px-5 pb-12 pt-16 text-center sm:px-7 lg:pb-[58px] lg:pt-[84px]", HAIR].join(" ")}>
          <h2
            data-reveal="up"
            className="mx-auto max-w-[820px] text-[clamp(30px,3.6vw,50px)] font-medium leading-[1.08] tracking-[-0.05em] text-[#0c0c0d]"
          >
            {PROBLEMS_COPY.title}
          </h2>
          <p
            data-reveal="up"
            style={d(160)}
            className="mx-auto mt-5 max-w-[520px] text-[15px] leading-[1.7] tracking-[-0.01em] text-neutral-500"
          >
            {PROBLEMS_COPY.text}
          </p>
        </div>

        <ul>
          {PROBLEMS_COPY.items.map((item, index) => (
            <li
              key={item.pain}
              data-reveal="rise"
              style={d(index * 60)}
              className={["grid md:grid-cols-2", index > 0 ? `border-t ${HAIR}` : ""].join(" ")}
            >
              <div className="bg-neutral-50/70 px-5 py-6 sm:px-7 md:px-10 md:py-8">
                <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-400">
                  {PROBLEMS_COPY.painLabel}
                </p>
                <p className="mt-2 text-[16.5px] leading-[1.5] tracking-[-0.02em] text-neutral-500">
                  {item.pain}
                </p>
              </div>
              <div className={["px-5 py-6 sm:px-7 md:border-l md:px-10 md:py-8", HAIR].join(" ")}>
                <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-900">
                  <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                  {PROBLEMS_COPY.gainLabel}
                </p>
                <p className="mt-2 text-[16.5px] font-medium leading-[1.5] tracking-[-0.02em] text-[#0c0c0d]">
                  {item.gain}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Col>
    </Bleed>
  );
}

/* ============================================================
   COMMENT FONCTIONNE STONE
   Les trois visuels sont des illustrations (données fictives).
============================================================ */

function StepConnect() {
  return (
    <div className="flex items-center justify-center gap-2.5 sm:gap-3">
      {LIVE_CHANNELS.slice(0, 4).map((channel) => (
        <span
          key={channel.key}
          className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_2px_4px_rgba(0,0,0,0.04),0_10px_20px_-10px_rgba(0,0,0,0.16)]"
        >
          <NetworkLogo channel={channel} className="h-5 w-5 text-[#0c0c0d]" />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#0c0c0d] text-white">
            <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden="true" />
          </span>
        </span>
      ))}
    </div>
  );
}

function StepCompose() {
  return (
    <div className={["w-[230px] rounded-2xl p-4", SOFT_CARD].join(" ")}>
      <div className="h-2 w-3/4 rounded-full bg-neutral-200" />
      <div className="mt-2 h-2 w-full rounded-full bg-neutral-100" />
      <div className="mt-2 h-2 w-2/3 rounded-full bg-neutral-100" />
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1">
          {LIVE_CHANNELS.slice(0, 3).map((channel) => (
            <span key={channel.key} className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f6f6f6]">
              <NetworkLogo channel={channel} className="h-3 w-3 text-[#0c0c0d]" />
            </span>
          ))}
        </span>
        <span className="rounded-full bg-[#f7cfcf] px-2.5 py-[3px] text-[10px] font-semibold uppercase tracking-[0.04em] text-[#9b3a3a] shadow-[inset_0_0_0_1px_rgba(155,58,58,0.12)]">
          Programmée
        </span>
      </div>
    </div>
  );
}

function StepTrack() {
  const bars = [38, 62, 46, 78, 54, 92, 66];
  return (
    <div className={["w-[230px] rounded-2xl p-4", SOFT_CARD].join(" ")}>
      <div className="flex h-[74px] items-end gap-2">
        {bars.map((h, i) => (
          <span
            key={i}
            className="flex-1 rounded-t-[4px]"
            style={{ height: `${h}%`, background: i === 5 ? "#171717" : "#e5e5e5" }}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-500">
        <span>Activité par jour</span>
        <span className="font-medium text-neutral-900">Exemple</span>
      </div>
    </div>
  );
}

const STEP_VISUALS = [StepConnect, StepCompose, StepTrack];

function How() {
  return (
    <Bleed id="how" className="scroll-mt-24">
      <Col>
        <div className={["border-b px-5 pb-12 pt-16 text-center sm:px-7 lg:pb-[58px] lg:pt-[84px]", HAIR].join(" ")}>
          <h2
            data-reveal="up"
            className="text-[clamp(32px,4vw,52px)] font-medium leading-[1.05] tracking-[-0.05em] text-[#0c0c0d]"
          >
            {HOW_COPY.title}
          </h2>
          <p
            data-reveal="up"
            style={d(140)}
            className="mx-auto mt-5 max-w-[520px] text-[15px] leading-[1.7] tracking-[-0.01em] text-neutral-500"
          >
            {HOW_COPY.text}
          </p>
        </div>

        <ol className="grid md:grid-cols-3">
          {HOW_COPY.steps.map((step, index) => {
            const Visual = STEP_VISUALS[index];
            return (
              <li
                key={step.title}
                data-reveal="up"
                style={d(index * 120)}
                className={["flex flex-col", index > 0 ? `border-t md:border-l md:border-t-0 ${HAIR}` : ""].join(" ")}
              >
                <div aria-hidden="true" className="relative flex h-[200px] items-center justify-center overflow-hidden bg-[#f6f6f6]">
                  <DotField
                    className="left-1/2 top-1/2 h-[220px] w-[320px] -translate-x-1/2 -translate-y-1/2"
                    strength={0.12}
                    mask="radial-gradient(ellipse, #000 15%, transparent 76%)"
                  />
                  <div className="relative">
                    <Visual />
                  </div>
                </div>
                <div className="px-6 pb-10 pt-8 sm:px-9">
                  <span className="text-[12px] font-medium tabular-nums text-neutral-400">
                    0{index + 1}
                  </span>
                  <h3 className="mt-3 text-[21px] font-medium leading-tight tracking-[-0.035em] text-[#0c0c0d]">
                    {step.title}
                  </h3>
                  <p className="mt-3 max-w-[340px] text-[14.5px] leading-[1.65] text-neutral-500">
                    {step.text}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
        <p className={["border-t px-5 py-3 text-center text-[12px] text-neutral-400 sm:px-7", HAIR].join(" ")}>
          {HOW_COPY.note}
        </p>
      </Col>
    </Bleed>
  );
}

/* ============================================================
   FONCTIONNALITÉS
============================================================ */

const FEATURE_ICONS: LucideIcon[] = [PenLine, CalendarDays, Share2, Lightbulb];

/* Filets : empilé (mobile), grille 2×2 (sm), une rangée de 4 (lg). */
const FEATURE_BORDERS = [
  "",
  "border-t sm:border-l sm:border-t-0",
  "border-t lg:border-l lg:border-t-0",
  "border-t sm:border-l lg:border-t-0",
];

function Features() {
  const [active, setActive] = useState<number | null>(null);

  return (
    <Bleed id="features" className="scroll-mt-24">
      <Col>
        <div className={["border-b px-5 pb-12 pt-16 text-center sm:px-7 lg:pb-[58px] lg:pt-[84px]", HAIR].join(" ")}>
          <h2
            data-reveal="up"
            className="text-[clamp(32px,4vw,52px)] font-medium leading-[1.05] tracking-[-0.05em] text-[#0c0c0d]"
          >
            {FEATURES_COPY.title}
          </h2>
          <p
            data-reveal="up"
            style={d(140)}
            className="mx-auto mt-5 max-w-[560px] text-[15px] leading-[1.7] tracking-[-0.01em] text-neutral-500"
          >
            {FEATURES_COPY.text}
          </p>
        </div>

        <ul className="grid sm:grid-cols-2 lg:grid-cols-4" onMouseLeave={() => setActive(null)}>
          {FEATURES_COPY.items.map(({ tag, title, text }, index) => {
            const Icon = FEATURE_ICONS[index];
            const isActive = active === index;
            return (
              <li
                key={tag}
                className={[
                  "relative p-2.5 md:p-[18px]",
                  FEATURE_BORDERS[index],
                  index > 0 ? HAIR : "",
                ].join(" ")}
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
              >
                <div data-reveal="up" style={d(index * 100)}>
                  <div
                    tabIndex={0}
                    className={[
                      "flex min-h-[270px] flex-col rounded-[24px] px-6 pb-8 pt-9 outline-none transition-[translate,background-color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
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
                    <p className="mt-7 text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-400">
                      {tag}
                    </p>
                    <h3 className="mt-2 text-[20px] font-medium leading-[1.2] tracking-[-0.035em] text-[#0c0c0d]">
                      {title}
                    </h3>
                    <p className="mt-3 text-[13.5px] leading-[1.65] text-neutral-500">{text}</p>
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
   INSIGHTS : démonstration (données fictives, signalées comme telles)
============================================================ */

const DEMO_DAYS = [
  { a: 42, b: 26 },
  { a: 58, b: 36 },
  { a: 34, b: 20 },
  { a: 76, b: 48 },
  { a: 62, b: 38 },
  { a: 28, b: 18 },
  { a: 44, b: 30 },
];

function InsightsDemo() {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...DEMO_DAYS.flatMap((day) => [day.a, day.b]));
  const focus = hover ?? 3;
  const f = DEMO_DAYS[focus];

  return (
    <div className={["w-full max-w-[560px] rounded-[22px] p-5 sm:p-7", SOFT_CARD].join(" ")}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <h3 className="text-[15px] font-medium tracking-[-0.02em] text-neutral-900">
            {INSIGHTS_COPY.chartTitle}
          </h3>
          <span className="rounded-full bg-[#f7cfcf] px-2.5 py-[3px] text-[10px] font-semibold uppercase tracking-[0.04em] text-[#9b3a3a] shadow-[inset_0_0_0_1px_rgba(155,58,58,0.12)]">
            {INSIGHTS_COPY.chartBadge}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5 text-[12px] text-neutral-500">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#171717]" />
            {INSIGHTS_COPY.chartLegend.reactions}
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#c7c7c7]" />
            {INSIGHTS_COPY.chartLegend.comments}
          </span>
        </div>
      </div>

      <div
        data-reveal="chart"
        data-chart-area
        className="mt-7 grid grid-cols-7 gap-1.5 sm:gap-3"
        onPointerLeave={() => setHover(null)}
      >
        {DEMO_DAYS.map((day, i) => {
          const on = i === focus;
          return (
            <button
              type="button"
              key={INSIGHTS_COPY.days[i]}
              onPointerEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={INSIGHTS_COPY.chartFooter(INSIGHTS_COPY.days[i], day.a, day.b)}
              className={["flex min-w-0 flex-col items-center gap-2 rounded-md", FOCUS].join(" ")}
            >
              <span className="flex h-[132px] w-full items-end justify-center gap-[3px] sm:h-[168px]">
                <span
                  className="chart-bar w-full max-w-[12px] rounded-t-[5px]"
                  style={{ "--h": Math.max(3, (day.a / max) * 100) + "%", "--i": i * 2, background: "#171717", opacity: on ? 1 : 0.22 } as CSSProperties}
                />
                <span
                  className="chart-bar w-full max-w-[12px] rounded-t-[5px]"
                  style={{ "--h": Math.max(3, (day.b / max) * 100) + "%", "--i": i * 2 + 1, background: "#c7c7c7", opacity: on ? 1 : 0.5 } as CSSProperties}
                />
              </span>
              <span className={`text-[11px] transition-colors duration-500 sm:text-[12px] ${on ? "font-medium text-neutral-900" : "text-neutral-400"}`}>
                {INSIGHTS_COPY.days[i]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 border-t border-neutral-100 pt-3 text-[12.5px] tabular-nums text-neutral-500">
        {INSIGHTS_COPY.chartFooter(INSIGHTS_COPY.days[focus], f.a, f.b)}
      </div>
    </div>
  );
}

function Insights() {
  return (
    <Bleed id="insights" className="scroll-mt-24">
      <Col>
        <div className="grid lg:grid-cols-[minmax(0,46%)_minmax(0,54%)]">
          <div className="flex flex-col justify-center px-5 pb-10 pt-16 sm:px-[57px] lg:py-[88px]">
            <div data-reveal="rise">
              <MiniTag icon={ChartColumn} label={INSIGHTS_COPY.tag} />
            </div>
            <h2
              data-reveal="up"
              style={d(100)}
              className="mt-[22px] text-[clamp(28px,3.2vw,44px)] font-medium leading-[1.08] tracking-[-0.045em] text-[#0c0c0d]"
            >
              {INSIGHTS_COPY.title}
            </h2>
            <p
              data-reveal="up"
              style={d(200)}
              className="mt-4 max-w-[470px] text-[15px] leading-[1.65] text-neutral-500"
            >
              {INSIGHTS_COPY.text}
            </p>
            <ul className="mt-7 flex max-w-[470px] flex-col gap-3.5">
              {INSIGHTS_COPY.points.map((point, index) => (
                <li
                  key={point}
                  data-reveal="up"
                  style={d(260 + index * 70)}
                  className="flex gap-3 text-[14.5px] leading-[1.55] text-neutral-700"
                >
                  <Check className="mt-[3px] h-4 w-4 shrink-0 text-neutral-900" strokeWidth={2} aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <div
            data-reveal="fade"
            style={d(150)}
            className="relative flex flex-col items-center justify-center gap-4 bg-[#f6f6f6] px-4 py-12 sm:px-8 lg:py-[88px]"
          >
            <DotField
              className="inset-[8%_6%]"
              strength={0.12}
              mask="radial-gradient(ellipse, #000 15%, transparent 80%)"
            />
            <div className="relative w-full max-w-[560px]">
              <InsightsDemo />
            </div>
            <p className="relative max-w-[460px] text-center text-[12.5px] leading-[1.6] text-neutral-500">
              {INSIGHTS_COPY.demoNote}
            </p>
          </div>
        </div>
      </Col>
    </Bleed>
  );
}

/* ============================================================
   CTA FINAL
============================================================ */

function CallToAction() {
  return (
    <Bleed id="cta" className="scroll-mt-24">
      <Col>
        <div className="grid lg:grid-cols-[22%_56%_22%]">
          <div className="relative hidden lg:block">
            <DotField
              className="inset-[14%_12%]"
              mask="radial-gradient(closest-side, #000 10%, transparent 100%)"
              strength={0.12}
            />
          </div>
          <div className={["flex flex-col items-center px-6 py-16 text-center lg:border-x lg:py-[84px]", HAIR].join(" ")}>
            <h2
              data-reveal="up"
              className="max-w-[640px] text-[clamp(30px,3.8vw,52px)] font-medium leading-[1.06] tracking-[-0.05em] text-[#0c0c0d]"
            >
              {FINAL_CTA_COPY.title}
            </h2>
            <p
              data-reveal="up"
              style={d(120)}
              className="mt-5 max-w-[460px] text-[16px] leading-[1.6] tracking-[-0.015em] text-neutral-500"
            >
              {FINAL_CTA_COPY.text}
            </p>
            <div data-reveal="up" style={d(240)} className="mt-8 w-full sm:w-auto">
              <SignupButton location="final" className="w-full sm:w-auto" />
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

const FOOTER_LINK_CLASS =
  "rounded text-left text-[14px] tracking-[-0.01em] text-neutral-400 transition-colors duration-300 hover:text-neutral-900";

function SiteFooter() {
  return (
    <footer>
      <Col>
        <div className="grid grid-cols-1 gap-12 px-5 pb-[72px] pt-[56px] sm:px-7 lg:grid-cols-[1.55fr_1fr_1fr_1fr] lg:gap-0 lg:px-12 lg:pb-[112px] lg:pt-[72px]">
          <div data-reveal="up">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection("top");
              }}
              aria-label="Stone — retour en haut de page"
              className={["inline-flex items-center gap-2 rounded-md", FOCUS].join(" ")}
            >
              <StoneLogoMark />
              <span className="text-[21px] font-medium tracking-[-0.04em]">Stone</span>
            </a>
            <p className="mt-6 max-w-[320px] text-[14px] leading-[1.65] text-neutral-500">
              {FOOTER_COPY.tagline}
            </p>
          </div>

          {FOOTER_COPY.columns.map((column, index) => (
            <nav
              key={column.title}
              aria-label={column.title}
              data-reveal="up"
              style={d(110 * (index + 1))}
              className="lg:border-l lg:border-black/[0.075] lg:pl-10"
            >
              <h2 className="text-[18px] font-medium tracking-[-0.035em] text-[#0c0c0d]">
                {column.title}
              </h2>
              <ul className="mt-6 flex flex-col gap-[22px]">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.href ? (
                      <a href={link.href} className={[FOOTER_LINK_CLASS, FOCUS].join(" ")}>
                        {link.label}
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => scrollToSection(link.section ?? "top")}
                        className={[FOOTER_LINK_CLASS, FOCUS].join(" ")}
                      >
                        {link.label}
                      </button>
                    )}
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
            {FOOTER_COPY.privacy}
          </a>
          <span className="relative z-10 justify-self-center">{FOOTER_COPY.rights}</span>
          <a
            href="/tos"
            className={["justify-self-center rounded transition-colors hover:text-neutral-900 lg:justify-self-end", FOCUS].join(" ")}
          >
            {FOOTER_COPY.terms}
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

  const variantKey: HeroVariantKey = useMemo(
    () => resolveHeroVariant(typeof window === "undefined" ? "" : window.location.search),
    [],
  );
  const viewTracked = useRef(false);

  useEffect(() => {
    if (viewTracked.current) return;
    viewTracked.current = true;
    rememberAttribution({ hero_variant: variantKey });
    track("landing_view", { hero_variant: variantKey });
  }, [variantKey]);

  return (
    <div
      ref={rootRef}
      id="top"
      className="min-h-screen overflow-x-clip bg-white font-display text-[#0c0c0d] antialiased selection:bg-[#0c0c0d] selection:text-white"
    >
      <Header />
      {/* La barre est en position fixe : on réserve sa hauteur. */}
      <div aria-hidden="true" className="h-[73px] lg:h-[91px]" />
      <main>
        <Hero variant={HERO_VARIANTS[variantKey]} />
        <Networks />
        <Problems />
        <How />
        <Features />
        <Insights />
        <CallToAction />
      </main>
      <SiteFooter />
      {/* Voile blanc : halo permanent + version d'arrivée qui se retire. */}
      <div aria-hidden="true" data-bottom-glow className="bottom-glow" />
      <div aria-hidden="true" className="bottom-glow-intro" />
    </div>
  );
}
