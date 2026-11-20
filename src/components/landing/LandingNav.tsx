import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Menu, Moon, Sun, X } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";

const LINKS = [
  { label: "Fonctionnalités", href: "#fonctionnalites", section: true },
  { label: "Le produit", href: "#produit", section: true },
  { label: "Tarifs", href: "#tarifs", section: true },
  { label: "FAQ", href: "#faq", section: true },
] as const;

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "start",
  });
}

export default function LandingNav() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const renderLink = (link: (typeof LINKS)[number], mobile = false) => (
    <a
      key={link.href}
      href={link.href}
      onClick={(event) => {
        if (link.section) {
          event.preventDefault();
          scrollToSection(link.href.slice(1));
        }
        if (mobile) setOpen(false);
      }}
      tabIndex={mobile && !open ? -1 : undefined}
      className={mobile ? "lp-mobile-link" : "lp-nav-link"}
    >
      {link.label}
    </a>
  );

  return (
    <header ref={rootRef} className="lp-nav">
      <a href="/" aria-label="Stone — accueil" className="lp-brand">
        <img src="/images/icon.png" alt="" width={38} height={38} />
        <span>stone<span className="lp-brand-dot">.</span></span>
      </a>

      <nav aria-label="Navigation principale" className="lp-nav-links">
        {LINKS.map((link) => renderLink(link))}
      </nav>

      <div className="lp-nav-actions">
        <button
          type="button"
          className="lp-theme-toggle"
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            toggle({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
          }}
          aria-label={isDark ? "Passer au thème clair" : "Passer au thème sombre"}
          title={isDark ? "Passer au thème clair" : "Passer au thème sombre"}
        >
          {isDark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
        </button>
        <a href="/signin" className="lp-login">Se connecter</a>
        <a href="/signup" className="lp-nav-cta">
          Créer un compte <ArrowUpRight size={15} aria-hidden="true" />
        </a>
        <button
          type="button"
          className="lp-menu-toggle"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="lp-mobile-menu"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        >
          {open ? <X size={19} /> : <Menu size={19} />}
        </button>
      </div>

      {open && (
        <div id="lp-mobile-menu" className="lp-mobile-menu">
          <nav aria-label="Menu mobile">{LINKS.map((link) => renderLink(link, true))}</nav>
          <div className="lp-mobile-actions">
            <a href="/signin" onClick={() => setOpen(false)}>Se connecter</a>
            <a href="/signup" onClick={() => setOpen(false)}>Créer un compte <ArrowUpRight size={15} /></a>
          </div>
        </div>
      )}
    </header>
  );
}
