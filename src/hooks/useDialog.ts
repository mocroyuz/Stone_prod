// src/hooks/useDialog.ts
// Comportement commun à toutes les boîtes de dialogue modales :
//  - Échap ferme UNIQUEMENT la boîte la plus haute (modals imbriquées)
//  - focus piégé dans la boîte (Tab / Maj+Tab bouclent)
//  - focus initial dans la boîte, restauré sur le déclencheur à la fermeture
//  - défilement de la page verrouillé, restauré quand la dernière boîte ferme
//    (compteur global : fermer deux modals dans le désordre ne laisse plus
//    la page bloquée).

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Pile des dialogues ouverts (le dernier est le plus haut). */
const stack: symbol[] = [];

let lockCount = 0;
let savedOverflow = "";
let savedPaddingRight = "";

function lockScroll() {
  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow;
    savedPaddingRight = document.body.style.paddingRight;
    // Évite le saut de mise en page quand la barre de défilement disparaît.
    const gap = window.innerWidth - document.documentElement.clientWidth;
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    document.body.style.overflow = "hidden";
  }
  lockCount += 1;
}

function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = savedOverflow;
    document.body.style.paddingRight = savedPaddingRight;
  }
}

// jsdom (tests) n'a pas de mise en page : getClientRects() y est toujours vide.
const HAS_LAYOUT =
  typeof navigator === "undefined" || !/jsdom/i.test(navigator.userAgent);

function visibleFocusables(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) =>
      (!HAS_LAYOUT || el.getClientRects().length > 0) &&
      el.getAttribute("aria-hidden") !== "true"
  );
}

type Options = {
  open: boolean;
  onClose: () => void;
  /** Conteneur du dialogue (doit pouvoir recevoir le focus : tabIndex={-1}). */
  ref: RefObject<HTMLElement | null>;
  /** false pour les menus / popovers qui ne doivent pas bloquer la page. */
  lockScroll?: boolean;
  /** false pour ne pas déplacer le focus à l'ouverture (ex. autoFocus géré à part). */
  autoFocus?: boolean;
  /** false pour désactiver Échap (étape non annulable). */
  closeOnEscape?: boolean;
};

export function useDialog({
  open,
  onClose,
  ref,
  lockScroll: lock = true,
  autoFocus = true,
  closeOnEscape = true,
}: Options) {
  // onClose peut changer à chaque rendu : on évite de réinstaller les écouteurs.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const id = Symbol("dialog");
    stack.push(id);
    const opener =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (lock) lockScroll();

    const root = ref.current;
    if (root && autoFocus && !root.contains(document.activeElement)) {
      const first = visibleFocusables(root)[0];
      (first ?? root).focus({ preventScroll: true });
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return;
      if (event.key === "Escape" && closeOnEscape) {
        if (event.defaultPrevented) return;
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const el = ref.current;
      if (!el) return;
      const items = visibleFocusables(el);
      if (items.length === 0) {
        event.preventDefault();
        el.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!el.contains(active) || active === el) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const i = stack.indexOf(id);
      if (i >= 0) stack.splice(i, 1);
      if (lock) unlockScroll();
      // Restaure le focus si le déclencheur existe encore (sinon le navigateur
      // le remettrait sur <body>, ce qui désoriente au clavier).
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open, lock, autoFocus, closeOnEscape, ref]);
}

/**
 * Échap pour un menu / popover posé sur (ou dans) une modale : le listener est
 * en phase de capture et stoppe la propagation, donc seul le popover se ferme
 * (la modale parente, elle, ne reçoit pas l'événement).
 */
export function useEscapeLayer(open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      event.preventDefault();
      closeRef.current();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open]);
}
