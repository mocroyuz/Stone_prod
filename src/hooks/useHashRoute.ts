import { useLayoutEffect, useState } from "react";

/**
 * Routeur basé sur le hash.
 *   "/#/"          -> ""
 *   "/#/faq"       -> "faq"
 *   "/#/signin?x=1" -> "signin"
 */

function readRoute(): string {
  return window.location.hash
    .replace(/^#\/?/, "")
    .split(/[?/]/)[0]
    .toLowerCase();
}

export function useHashRoute(): string {
  const [route, setRoute] = useState<string>(readRoute);

  useLayoutEffect(() => {
    const onRouteChange = () => {
      setRoute(readRoute());
      window.scrollTo({ top: 0, behavior: "auto" });
    };

    window.addEventListener("popstate", onRouteChange);
    window.addEventListener("hashchange", onRouteChange);
    return () => {
      window.removeEventListener("popstate", onRouteChange);
      window.removeEventListener("hashchange", onRouteChange);
    };
  }, []);

  return route;
}

export function navigate(to: string, options: { replace?: boolean } = {}) {
  const clean = to.replace(/^[#/]+/, "").replace(/\/+$/, "");
  const hash = `#/${clean}`;

  if (window.location.hash === hash) return;

  const url = `${window.location.pathname}${window.location.search}${hash}`;

  if (options.replace) {
    window.history.replaceState({}, "", url);
  } else {
    window.history.pushState({}, "", url);
  }

  window.dispatchEvent(new PopStateEvent("popstate"));
}