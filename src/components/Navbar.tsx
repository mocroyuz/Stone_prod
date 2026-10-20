import { useEffect, useRef, useState } from "react";
import type { Theme } from "../hooks/useTheme";
import { navigate } from "../hooks/useHashRoute";

/* Ordre complet des liens du menu. */
const LINKS = [
  "Home",
  "Our work",
  "FAQs",
  "Privacy policy",
  "Tos",
  "Support",
];

/* Répartition : 3 premiers à gauche, 3 derniers à droite. */
const HALF = Math.ceil(LINKS.length / 2);
const LINKS_LEFT = LINKS.slice(0, HALF);
const LINKS_RIGHT = LINKS.slice(HALF);

/* Correspondance libellé → route.
   Les clés doivent correspondre EXACTEMENT aux libellés de LINKS. */
const LINK_ROUTES: Record<string, string> = {
  Home: "",
  "Our work": "",
  FAQs: "faq",
  "Privacy policy": "privacy",
  Tos: "tos",
  Support: "faq",
};

const LINK_TARGETS: Record<string, string> = {
  "Our work": "our-work",
  Support: "faq-support",
};

function scrollToTarget(id: string) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    });
  });
}

/* Garde-fou CSS : empêche la sélection de texte et le surlignage bleu sur
   tous les contrôles interactifs de la navbar (boutons, liens, icônes SVG).
   Aucun impact sur pointer-events : tout reste cliquable. */
const NAVBAR_SELECTION_GUARD = `
#app-navbar button,
#app-navbar a,
#app-navbar svg,
#app-navbar [role="switch"] {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

#app-navbar button::selection,
#app-navbar button *::selection,
#app-navbar a::selection,
#app-navbar a *::selection,
#app-navbar svg::selection,
#app-navbar svg *::selection {
  background: transparent;
  color: inherit;
}
`;

type Props = {
  theme: Theme;
  onToggleTheme: (origin?: { x: number; y: number }) => void;
};

export default function Navbar({ theme, onToggleTheme }: Props) {
  const [open, setOpen] = useState(false);
  const isDark = theme === "dark";

  // Référence pour le conteneur du menu (bouton + panneau déroulant)
  const menuRef = useRef<HTMLDivElement>(null);

  // Gestion de la fermeture au clic à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Si le menu est ouvert et que le clic est en dehors de menuRef, on ferme
      if (open && menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // Gestion de la touche Échap
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (label: string) => {
    setOpen(false);
    const route = LINK_ROUTES[label];
    if (route !== undefined) {
      navigate(route);
      const target = LINK_TARGETS[label];
      if (target) scrollToTarget(target);
    }
  };

  const hrefFor = (label: string) => {
    const route = LINK_ROUTES[label];
    return route ? `/${route}` : "/";
  };

  const renderLink = (label: string) => (
    <li key={label}>
      <a
        href={hrefFor(label)}
        tabIndex={open ? 0 : -1}
        onClick={(e) => {
          e.preventDefault();
          go(label);
        }}
        className="block select-none text-center text-[clamp(12px,1.2vw,15px)] font-medium text-white/85 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
      >
        {label}
      </a>
    </li>
  );

  return (
    <header
      id="app-navbar"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-[clamp(10px,3vw,24px)] pt-[clamp(8px,1.3vw,16px)]"
    >
      <style>{NAVBAR_SELECTION_GUARD}</style>

      {/* On attache la ref ici pour englober à la fois le bouton et le menu déroulant */}
      <div ref={menuRef} className="pointer-events-auto w-full max-w-[520px]">
        {/* top bar */}
        <div className="relative flex items-stretch justify-center gap-[clamp(4px,0.5vw,7px)]">
          {/* pill */}
          <div className="relative flex h-[clamp(38px,4.1vw,50px)] items-center rounded-full bg-[#3d3d3d] p-[clamp(3px,0.4vw,5px)] pl-[clamp(11px,1.3vw,17px)] shadow-[0_14px_32px_-16px_rgba(0,0,0,0.5)] ring-1 ring-black/5 dark:ring-white/10">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls="nav-panel"
              className="group flex select-none items-center gap-[clamp(6px,0.7vw,9px)] pr-[clamp(8px,1vw,13px)] text-white"
            >
              <span className="relative block h-[clamp(10px,1.1vw,14px)] w-[clamp(14px,1.45vw,18px)] select-none">
                <span
                  className={[
                    "absolute left-0 h-[2px] w-full rounded-full bg-white transition-all duration-300 ease-out",
                    open ? "top-1/2 -translate-y-1/2 rotate-45" : "top-[15%] rotate-0",
                  ].join(" ")}
                />
                <span
                  className={[
                    "absolute left-0 h-[2px] w-full rounded-full bg-white transition-all duration-300 ease-out",
                    open ? "top-1/2 -translate-y-1/2 -rotate-45" : "top-[75%] rotate-0",
                  ].join(" ")}
                />
              </span>
              <span className="select-none text-[clamp(12px,1.2vw,15px)] font-medium tracking-[-0.01em]">
                Menu
              </span>
            </button>

            <a
              href="/signup"
              onClick={(e) => {
                e.preventDefault();
                navigate("signup");
              }}
              className="flex h-full select-none items-center rounded-full bg-[#eceae5] px-[clamp(12px,1.5vw,20px)] text-[clamp(11.5px,1.15vw,14.5px)] font-medium tracking-[-0.01em] text-neutral-800 transition hover:bg-white"
            >
              Get&nbsp;started
            </a>

            {/* theme toggle — inside pill, far right */}
            <button
              type="button"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                onToggleTheme({
                  x: r.left + r.width / 2,
                  y: r.top + r.height / 2,
                });
              }}
              role="switch"
              aria-checked={!isDark}
              aria-label="Toggle light theme"
              title={isDark ? "Switch to light theme" : "Switch to dark theme"}
              className="relative ml-[clamp(3px,0.4vw,5px)] flex h-full w-[clamp(52px,5.5vw,68px)] shrink-0 select-none items-center tint rounded-full bg-[#141416] ring-1 ring-white/[0.06]"
            >
              <span
                className={[
                  "absolute top-1/2 aspect-square h-[calc(100%-clamp(5px,0.55vw,7px))] -translate-y-1/2 rounded-full bg-[#2f2f33] shadow-[inset_0_1px_0_rgba(255,255,255,0.09)] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  isDark
                    ? "left-[clamp(2.5px,0.28vw,3.5px)]"
                    : "left-[calc(100%-clamp(2.5px,0.28vw,3.5px))] -translate-x-full",
                ].join(" ")}
              />
              <span className="relative z-10 flex w-full select-none items-center justify-around px-[clamp(2px,0.3vw,4px)]">
                <svg
                  viewBox="0 0 24 24"
                  className={[
                    "h-[clamp(11px,1.15vw,14px)] w-[clamp(11px,1.15vw,14px)] select-none tint transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    isDark
                      ? "scale-100 rotate-0 text-white"
                      : "scale-90 -rotate-[25deg] text-white/30",
                  ].join(" ")}
                  fill="currentColor"
                >
                  <path d="M20.5 15.1A8.6 8.6 0 0 1 9.4 3.8a8.7 8.7 0 1 0 11.1 11.3Z" />
                </svg>
                <svg
                  viewBox="0 0 24 24"
                  className={[
                    "h-[clamp(11px,1.15vw,14px)] w-[clamp(11px,1.15vw,14px)] select-none tint transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    isDark
                      ? "scale-90 rotate-[25deg] text-white/30"
                      : "scale-100 rotate-0 text-white",
                  ].join(" ")}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                >
                  <circle cx="12" cy="12" r="3.4" />
                  <path d="M12 3.2v2.3M12 18.5v2.3M4.8 4.8l1.6 1.6M17.6 17.6l1.6 1.6M3.2 12h2.3M18.5 12h2.3M4.8 19.2l1.6-1.6M17.6 6.4l1.6-1.6" />
                </svg>
              </span>
            </button>
          </div>
        </div>

        {/* dropdown panel */}
        <div
          id="nav-panel"
          className={[
            "grid overflow-hidden transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          ].join(" ")}
        >
          <div className="min-h-0">
            <nav
              className={[
                "mx-auto mt-[clamp(6px,0.7vw,10px)] w-[min(100%,340px)] rounded-[clamp(18px,2vw,26px)] bg-[#3d3d3d] px-[clamp(14px,2vw,26px)] py-[clamp(14px,1.9vw,24px)] shadow-[0_24px_54px_-24px_rgba(0,0,0,0.5)] ring-1 ring-black/5 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] dark:ring-white/10",
                open ? "translate-y-0" : "-translate-y-3",
              ].join(" ")}
            >
              <div className="grid select-none grid-cols-2 gap-x-[clamp(14px,2.4vw,34px)]">
                <ul className="flex select-none flex-col items-center gap-y-[clamp(9px,1.1vw,14px)]">
                  {LINKS_LEFT.map(renderLink)}
                </ul>

                <ul className="flex select-none flex-col items-center gap-y-[clamp(9px,1.1vw,14px)]">
                  {LINKS_RIGHT.map(renderLink)}
                </ul>
              </div>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}