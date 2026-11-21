import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "prototype-saas-theme";

type DocWithVT = Document & {
  startViewTransition?: (
    cb: () => void
  ) => {
    ready: Promise<void>;
  };
};

export type ToggleOrigin = {
  x: number;
  y: number;
};

export type ToggleThemeFn = (
  origin?: ToggleOrigin
) => void;

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: ToggleThemeFn;
};

/* ============================================================================
   Contexte
   ----------------------------------------------------------------------------
   Avant : chaque composant appelant useTheme() avait son PROPRE useState,
   initialisé depuis le localStorage mais jamais synchronisé avec les autres
   instances. Résultat : cliquer sur le switch de la sidebar ne changeait
   rien de visible, puisque son état interne n'était pas partagé avec le
   reste de la page (et onToggleTheme n'était de toute façon pas transmis
   par la plupart des pages).

   Maintenant : un seul état, partagé par toute l'application via le
   contexte ci-dessous. Toute page qui appelle useTheme() lit et écrit
   le MÊME état que la sidebar, la navbar, etc.
============================================================================ */

const ThemeContext =
  createContext<ThemeContextValue | null>(
    null
  );

function getInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  const stored = window.localStorage.getItem(
    THEME_STORAGE_KEY
  );

  return stored === "dark" ? "dark" : "light";
}

/* ============================================================================
   Provider — à monter UNE SEULE FOIS, à la racine de l'app (voir App.tsx).

   Écrit avec createElement plutôt qu'en JSX pour que ce fichier puisse
   rester un .ts classique (aucun risque de doublon .ts / .tsx qui ferait
   pointer certains imports vers une ancienne version du hook).
============================================================================ */

export function ThemeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [theme, setTheme] = useState<Theme>(
    getInitialTheme
  );

  const busy = useRef(false);

  useEffect(() => {
    const root = document.documentElement;

    root.classList.toggle(
      "dark",
      theme === "dark"
    );

    root.style.colorScheme = theme;

    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      theme
    );
  }, [theme]);

  const toggle = useCallback<ToggleThemeFn>(
    (origin) => {
      if (busy.current) return;

      const doc = document as DocWithVT;

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      const flip = () => {
        setTheme((current) =>
          current === "light"
            ? "dark"
            : "light"
        );
      };

      // Pas de View Transition disponible
      if (
        !doc.startViewTransition ||
        reduceMotion ||
        !origin
      ) {
        flip();
        return;
      }

      busy.current = true;

      const { x, y } = origin;

      const radius = Math.hypot(
        Math.max(
          x,
          window.innerWidth - x
        ),
        Math.max(
          y,
          window.innerHeight - y
        )
      );

      const transition =
        doc.startViewTransition(() => {
          flip();
        });

      transition.ready
        .then(() => {
          document.documentElement.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${radius}px at ${x}px ${y}px)`,
              ],
            },
            {
              duration: 620,
              easing:
                "cubic-bezier(0.65, 0, 0.35, 1)",
              pseudoElement:
                "::view-transition-new(root)",
            }
          );
        })
        .catch(() => {})
        .finally(() => {
          window.setTimeout(() => {
            busy.current = false;
          }, 650);
        });
    },
    []
  );

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggle,
    }),
    [theme, toggle]
  );

  return createElement(
    ThemeContext.Provider,
    { value },
    children
  );
}

/* ============================================================================
   Hook — identique à l'ancienne API (theme, setTheme, toggle),
   mais lit maintenant l'état partagé du contexte.
============================================================================ */

export function useTheme() {
  const ctx = useContext(ThemeContext);

  if (!ctx) {
    throw new Error(
      "useTheme doit être utilisé à l'intérieur de <ThemeProvider>."
    );
  }

  return ctx;
}