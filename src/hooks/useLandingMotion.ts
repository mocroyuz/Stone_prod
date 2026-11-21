import { useEffect, type RefObject } from "react";

/**
 * Mouvement de la landing, en un seul endroit :
 *  - [data-reveal]        → révélé une fois, quand l'élément entre dans l'écran
 *  - [data-parallax]      → décalage vertical lissé, lié au scroll (px par px scrollé)
 *  - [data-scroll-rotate] → rotation lissée, liée au scroll (deg par px scrollé)
 *
 * Tout passe par les propriétés individuelles `translate` / `rotate` /
 * `scale`, pour ne jamais entrer en conflit avec les `transform` posés par
 * les classes Tailwind ou les animations CSS. `prefers-reduced-motion`
 * coupe l'ensemble.
 */

const PARALLAX_RANGE = 900;

type Tracked = {
  el: HTMLElement;
  speed: number;
  kind: "shift" | "spin";
  value: number;
};

export function useLandingMotion(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups: Array<() => void> = [];

    /* ---------- Révélation à l'entrée dans l'écran ---------- */
    const targets = Array.from(
      root.querySelectorAll<HTMLElement>("[data-reveal]"),
    );

    if (reduce || !("IntersectionObserver" in window)) {
      for (const el of targets) el.setAttribute("data-revealed", "");
    } else {
      const io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.setAttribute("data-revealed", "");
            io.unobserve(entry.target);
          }
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.01 },
      );
      for (const el of targets) {
        if (!el.hasAttribute("data-revealed")) io.observe(el);
      }
      cleanups.push(() => io.disconnect());
    }

    /* ---------- Parallax / rotation liés au scroll ---------- */
    if (!reduce) {
      const tracked: Tracked[] = [
        ...Array.from(root.querySelectorAll<HTMLElement>("[data-parallax]")).map(
          (el): Tracked => ({
            el,
            speed: Number(el.dataset.parallax) || 0,
            kind: "shift",
            value: 0,
          }),
        ),
        ...Array.from(
          root.querySelectorAll<HTMLElement>("[data-scroll-rotate]"),
        ).map(
          (el): Tracked => ({
            el,
            speed: Number(el.dataset.scrollRotate) || 0,
            kind: "spin",
            value: 0,
          }),
        ),
      ];

      if (tracked.length > 0) {
        const targetOf = (item: Tracked) =>
          item.kind === "shift"
            ? Math.min(window.scrollY, PARALLAX_RANGE) * item.speed
            : window.scrollY * item.speed;

        const paint = (item: Tracked) => {
          const v = item.value.toFixed(2);
          if (item.kind === "shift") item.el.style.translate = `0 ${v}px`;
          else item.el.style.rotate = `${v}deg`;
        };

        // Position de départ = position réelle : pas d'animation parasite
        // quand on recharge la page au milieu du scroll.
        for (const item of tracked) {
          item.value = targetOf(item);
          paint(item);
        }

        let raf = 0;
        let last = 0;

        const tick = (now: number) => {
          const dt = Math.min(64, now - last || 16);
          last = now;
          // Lissage indépendant de la fréquence d'écran.
          const k = 1 - Math.exp(-dt / 120);
          let moving = false;
          for (const item of tracked) {
            const target = targetOf(item);
            item.value += (target - item.value) * k;
            if (Math.abs(target - item.value) > 0.02) moving = true;
            else item.value = target;
            paint(item);
          }
          raf = moving ? requestAnimationFrame(tick) : 0;
        };

        const kick = () => {
          if (raf) return;
          last = performance.now();
          raf = requestAnimationFrame(tick);
        };

        window.addEventListener("scroll", kick, { passive: true });
        cleanups.push(() => {
          window.removeEventListener("scroll", kick);
          cancelAnimationFrame(raf);
        });
      }
    }

    return () => {
      for (const fn of cleanups) fn();
    };
  }, [rootRef]);
}
