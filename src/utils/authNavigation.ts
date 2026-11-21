import { navigate } from "../hooks/useHashRoute";

function readUrlParams(): URLSearchParams {
  const params = new URLSearchParams();
  if (typeof window === "undefined") return params;

  new URLSearchParams(window.location.search).forEach((value, key) => {
    params.set(key, value);
  });

  const rawHash = window.location.hash || "";
  const queryIndex = rawHash.indexOf("?");
  if (queryIndex !== -1) {
    new URLSearchParams(rawHash.slice(queryIndex + 1)).forEach((value, key) => {
      params.set(key, value);
    });
  }

  return params;
}

export function navigateAfterSignin(): boolean {
  const params = readUrlParams();
  const next = params.get("next");
  const plan = params.get("plan");
  const period = params.get("period");

  if (!next) return false;

  if (next === "/pricing" || next === "pricing") {
    const query = new URLSearchParams();
    if (plan) query.set("plan", plan);
    if (period) query.set("period", period);

    const search = query.toString();
    navigate(`/pricing${search ? `?${search}` : ""}`);
    return true;
  }

  if (next.startsWith("/")) {
    navigate(next);
    return true;
  }

  return false;
}
