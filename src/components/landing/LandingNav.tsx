import { useEffect, useRef, useState } from "react";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { cn } from "../../utils/cn";

/* Routes réelles de l'application : "/", "/faq", "/privacy", "/tos". */
const LINKS = [
  { label: "Accueil", href: "/" },
  { label: "FAQ", href: "/faq" },
  { label: "Confidentialité", href: "/privacy" },
  { label: "CGU", href: "/tos" },
] as const;

const linkClass =
  "rounded-full px-3.5 py-2 text-[13.5px] font-medium text-neutral-600 transition-colors hover:bg-black/[0.05] hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/[0.07] dark:hover:text-white";

/** Barre de navigation statique (non fixée) de la landing. */
export default function LandingNav() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header ref={rootRef} className="relative z-30 mx-auto w-full max-w-[1200px] px-5 pt-5 sm:px-8 sm:pt-6">
      <div className="flex h-12 items-center justify-between gap-3">
        <a href="/" aria-label="Stone — accueil" className="flex shrink-0 items-center gap-1.5">
          <img
            src="/images/icon.png"
            alt=""
            width={36}
            height={36}
            className="h-8 w-auto object-contain dark:invert"
            draggable={false}
          />
          <span className="font-display text-[19px] font-bold tracking-[-0.03em]">Stone</span>
        </a>

        <nav aria-label="Navigation principale" className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} className={linkClass}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              toggle({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
            }}
            aria-label={isDark ? "Passer au thème clair" : "Passer au thème sombre"}
            title={isDark ? "Passer au thème clair" : "Passer au thème sombre"}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-black/[0.08] bg-white text-neutral-700 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition hover:bg-neutral-50 dark:border-white/[0.1] dark:bg-white/[0.06] dark:text-neutral-200 dark:shadow-none dark:hover:bg-white/[0.1]"
          >
            {isDark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
          </button>

          <a
            href="/signin"
            className="hidden h-10 items-center rounded-full px-4 text-[13.5px] font-medium text-neutral-700 transition hover:bg-black/[0.05] dark:text-neutral-200 dark:hover:bg-white/[0.07] sm:inline-flex"
          >
            Se connecter
          </a>

          <a
            href="/signup"
            className="hidden h-10 items-center rounded-full bg-neutral-900 px-5 text-[13.5px] font-medium text-white shadow-[0_8px_18px_-10px_rgba(0,0,0,0.6)] transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:shadow-none dark:hover:bg-neutral-200 sm:inline-flex"
          >
            Commencer
          </a>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="landing-mobile-menu"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-black/[0.08] bg-white text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.05)] dark:border-white/[0.1] dark:bg-white/[0.06] dark:text-white dark:shadow-none md:hidden"
          >
            {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Menu mobile : volet déroulant sous la barre. */}
      <div
        id="landing-mobile-menu"
        className={cn(
          "absolute inset-x-5 top-full mt-2 origin-top rounded-[22px] border border-black/[0.08] bg-white p-3 shadow-[0_24px_48px_-24px_rgba(0,0,0,0.35)] transition duration-200 dark:border-white/[0.1] dark:bg-[#141416] dark:shadow-[0_28px_56px_-24px_rgba(0,0,0,0.9)] sm:inset-x-8 md:hidden",
          open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0"
        )}
      >
        <nav aria-label="Menu mobile" className="flex flex-col">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              tabIndex={open ? 0 : -1}
              onClick={() => setOpen(false)}
              className="rounded-2xl px-4 py-3.5 text-[15px] font-medium text-neutral-800 transition hover:bg-black/[0.04] dark:text-neutral-100 dark:hover:bg-white/[0.06]"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="mt-2 grid grid-cols-2 gap-2 border-t border-black/[0.07] pt-3 dark:border-white/[0.08]">
          <a
            href="/signin"
            tabIndex={open ? 0 : -1}
            className="flex h-12 items-center justify-center rounded-full border border-black/[0.1] text-[14px] font-medium dark:border-white/[0.14]"
          >
            Se connecter
          </a>
          <a
            href="/signup"
            tabIndex={open ? 0 : -1}
            className="flex h-12 items-center justify-center rounded-full bg-neutral-900 text-[14px] font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            Commencer
          </a>
        </div>
      </div>
    </header>
  );
}
