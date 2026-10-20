import { useLayoutEffect, useState } from "react";

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
      setLocation({
        route: readRoute(),
        search: window.location.search,
        hash: window.location.hash,
      });
      window.scrollTo({ top: 0, behavior: "auto" });
    };

    window.addEventListener("popstate", onRouteChange);
    window.addEventListener("hashchange", onRouteChange);
    return () => {
      window.removeEventListener("popstate", onRouteChange);
      window.removeEventListener("hashchange", onRouteChange);
    };
  }, []);

  return location.route;
}

export function navigate(to: string, options: { replace?: boolean } = {}) {
  const clean = to.replace(/^[#/]+/, "").replace(/\/+$/, "");
  const url = clean ? `/${clean}` : "/";
  const currentUrl = `${window.location.pathname}${window.location.search}`;
  if (currentUrl === url) return;

  if (options.replace) {
    window.history.replaceState({}, "", url);
  } else {
    window.history.pushState({}, "", url);
  }

  window.dispatchEvent(new PopStateEvent("popstate"));
}