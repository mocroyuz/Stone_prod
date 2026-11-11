import { startTransition, useLayoutEffect, useState } from "react";

/**
 * Lit les anciennes URL avec hash et les remplace par des chemins classiques.
 */

function normalizeLegacyHashRoute(): void {
  const { hash, search } = window.location;
  if (!hash.startsWith("#/")) return;

  const legacyRoute = hash.slice(1);
  const nestedHashIndex = legacyRoute.indexOf("#");
  const route = nestedHashIndex === -1
    ? legacyRoute
    : legacyRoute.slice(0, nestedHashIndex);
  const nestedHash = nestedHashIndex === -1
    ? ""
    : legacyRoute.slice(nestedHashIndex);

  window.history.replaceState(
    null,
    "",
    `${route}${search}${nestedHash}` || "/"
  );
}

function readRoute(): string {
  normalizeLegacyHashRoute();
  return window.location.pathname
    .replace(/^\/+|\/+$/g, "")
    .split("/")[0]
    .toLowerCase();
}

export function useHashRoute(): string {
  const [location, setLocation] = useState(() => ({
    route: readRoute(),
    search: window.location.search,
    hash: window.location.hash,
  }));

  useLayoutEffect(() => {
    const onRouteChange = () => {
      // Une navigation peut charger un composant lazy. En transition,
      // React conserve la page actuelle jusqu’à ce que la suivante soit prête,
      // au lieu d’afficher le fallback Suspense entre les deux.
      startTransition(() => {
        setLocation({
          route: readRoute(),
          search: window.location.search,
          hash: window.location.hash,
        });
      });
      window.scrollTo({ top: 0, behavior: "auto" });
    };

    // Intercepte les liens internes oubliés dans les pages et composants.
    // La navigation passe par History API : React change de page sans recharger
    // le document ni relancer toute l'application.
    const onDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (
        !anchor ||
        anchor.hasAttribute("download") ||
        (anchor.target && anchor.target !== "_self") ||
        anchor.relList.contains("external")
      ) return;

      let destination: URL;
      try {
        destination = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (
        destination.origin !== window.location.origin ||
        !["http:", "https:"].includes(destination.protocol) ||
        destination.pathname.startsWith("/api/") ||
        destination.pathname.startsWith("/assets/") ||
        destination.pathname === "/canva-return" ||
        /^\/(?:tiktok|pinterest|youtube|canva|dropbox|googledrive|googlephotos)\/callback\/?$/i.test(destination.pathname)
      ) return;

      // Laisse le navigateur gérer les ancres dans la page courante.
      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search &&
        destination.hash
      ) return;

      event.preventDefault();
      navigate(
        `${destination.pathname}${destination.search}${destination.hash}`
      );
    };

    window.addEventListener("popstate", onRouteChange);
    window.addEventListener("hashchange", onRouteChange);
    document.addEventListener("click", onDocumentClick);

    return () => {
      window.removeEventListener("popstate", onRouteChange);
      window.removeEventListener("hashchange", onRouteChange);
      document.removeEventListener("click", onDocumentClick);
    };
  }, []);

  return location.route;
}

export function navigate(to: string, options: { replace?: boolean } = {}) {
  const clean = to.replace(/^[#/]+/, "");
  const target = clean
    ? new URL(`/${clean}`, window.location.origin)
    : new URL("/", window.location.origin);
  const url = `${target.pathname}${target.search}${target.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (currentUrl === url) return;

  if (options.replace) {
    window.history.replaceState({}, "", url);
  } else {
    window.history.pushState({}, "", url);
  }

  window.dispatchEvent(new PopStateEvent("popstate"));
}
