import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// supabase.ts garde de l'état au niveau du module (token en mémoire, refresh
// en cours…) : on le recharge à neuf pour chaque test.
async function loadModule() {
  vi.resetModules();
  return import("./supabase");
}

type FetchMock = ReturnType<typeof vi.fn>;

function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {}
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
}

function mockFetch(...responses: Response[]): FetchMock {
  const fetchMock = vi.fn();
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function callUrl(fetchMock: FetchMock, index: number): string {
  return String(fetchMock.mock.calls[index][0]);
}

function callHeaders(fetchMock: FetchMock, index: number): Headers {
  return new Headers((fetchMock.mock.calls[index][1] as RequestInit).headers);
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  window.location.hash = "";
});

afterEach(() => {
  vi.useRealTimers();
});

describe("oauthStateMatches", () => {
  it("accepte deux états identiques non vides", async () => {
    const { oauthStateMatches } = await loadModule();
    expect(oauthStateMatches("abc", "abc")).toBe(true);
  });

  it("refuse un état différent, vide ou absent", async () => {
    const { oauthStateMatches } = await loadModule();
    expect(oauthStateMatches("abc", "abd")).toBe(false);
    expect(oauthStateMatches("", "")).toBe(false);
    expect(oauthStateMatches(null, "abc")).toBe(false);
    expect(oauthStateMatches("abc", null)).toBe(false);
  });
});

describe("isDuplicateError", () => {
  it("reconnaît les codes, le statut 409 et les messages de doublon", async () => {
    const { isDuplicateError } = await loadModule();
    expect(isDuplicateError({ code: "TAG_DUPLICATE" })).toBe(true);
    expect(isDuplicateError({ code: "GROUP_DUPLICATE" })).toBe(true);
    expect(isDuplicateError({ code: "23505" })).toBe(true);
    expect(isDuplicateError({ status: 409 })).toBe(true);
    expect(isDuplicateError(new Error("Tag already exists"))).toBe(true);
  });

  it("ne confond pas avec une autre erreur", async () => {
    const { isDuplicateError } = await loadModule();
    expect(isDuplicateError({ status: 500 })).toBe(false);
    expect(isDuplicateError(new Error("Network down"))).toBe(false);
    expect(isDuplicateError(null)).toBe(false);
  });
});

describe("session : stockage des tokens", () => {
  it("garde l'access token en mémoire, jamais dans le navigateur", async () => {
    const mod = await loadModule();
    mockFetch(
      jsonResponse({
        user: { id: "u1", email: "a@b.c" },
        session: { access_token: "ACCESS", refresh_token: "REFRESH" },
      })
    );

    await mod.signIn("a@b.c", "pw");

    expect(mod.getAccessToken()).toBe("ACCESS");
    expect(JSON.stringify({ ...sessionStorage })).not.toContain("ACCESS");
    expect(JSON.stringify({ ...localStorage })).not.toContain("ACCESS");
    expect(JSON.stringify({ ...sessionStorage })).not.toContain("REFRESH");
    expect(JSON.stringify({ ...localStorage })).not.toContain("REFRESH");
  });

  it("migre un ancien token de localStorage vers la mémoire puis le supprime", async () => {
    localStorage.setItem("crossflow_access_token", "LEGACY");
    const mod = await loadModule();

    expect(mod.getAccessToken()).toBe("LEGACY");
    expect(localStorage.getItem("crossflow_access_token")).toBeNull();
    expect(sessionStorage.getItem("crossflow_access_token")).toBeNull();
  });

  it("clearSession efface le token et prévient l'application", async () => {
    const mod = await loadModule();
    mockFetch(jsonResponse({ session: { access_token: "ACCESS" } }));
    await mod.signIn("a@b.c", "pw");

    const listener = vi.fn();
    window.addEventListener("stone:auth-expired", listener);
    mod.clearSession();
    window.removeEventListener("stone:auth-expired", listener);

    expect(mod.getAccessToken()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("signIn et MFA en attente", () => {
  it("marque la MFA en attente et n'ouvre pas la session", async () => {
    const mod = await loadModule();
    mockFetch(
      jsonResponse({
        session: { access_token: "AAL1" },
        mfa_enabled: true,
        mfa_required: true,
        aal: "aal1",
      })
    );

    await mod.signIn("a@b.c", "pw");

    expect(mod.isMfaPending()).toBe(true);
    expect(mod.hasStoredSession()).toBe(false);
  });

  it("n'exige pas de MFA quand le compte n'en a pas", async () => {
    const mod = await loadModule();
    mockFetch(jsonResponse({ session: { access_token: "OK" } }));

    await mod.signIn("a@b.c", "pw");

    expect(mod.isMfaPending()).toBe(false);
    expect(mod.hasStoredSession()).toBe(true);
  });
});

describe("apiRequest", () => {
  async function signedIn() {
    const mod = await loadModule();
    mockFetch(jsonResponse({ session: { access_token: "TOKEN" } }));
    await mod.signIn("a@b.c", "pw");
    return mod;
  }

  it("envoie le bearer token et les cookies (credentials: include)", async () => {
    const mod = await signedIn();
    const fetchMock = mockFetch(jsonResponse({ hello: "world" }));

    const result = await mod.apiRequest<{ hello: string }>("/api/ping");

    expect(result).toEqual({ hello: "world" });
    expect(callUrl(fetchMock, 0)).toBe("/api/ping");
    expect(callHeaders(fetchMock, 0).get("Authorization")).toBe("Bearer TOKEN");
    expect((fetchMock.mock.calls[0][1] as RequestInit).credentials).toBe("include");
  });

  it("lève MfaRequiredError sur un 403 MFA_REQUIRED", async () => {
    const mod = await signedIn();
    mockFetch(
      jsonResponse(
        { code: "MFA_REQUIRED", error: "Verify your identity" },
        { status: 403 }
      )
    );

    const error = await mod.apiRequest("/api/user/password").catch((e) => e);

    expect(mod.isMfaRequiredError(error)).toBe(true);
    expect((error as Error).message).toBe("Verify your identity");
  });

  it("lève RateLimitError avec le délai du header Retry-After", async () => {
    const mod = await signedIn();
    mockFetch(
      jsonResponse(
        { error: "Too many attempts" },
        { status: 429, headers: { "Retry-After": "42" } }
      )
    );

    const error = await mod.apiRequest("/api/mfa/verify").catch((e) => e);

    expect(mod.isRateLimitError(error)).toBe(true);
    expect((error as { retryAfterSeconds: number }).retryAfterSeconds).toBe(42);
  });

  it("utilise 60 s par défaut si le serveur ne donne aucun délai", async () => {
    const mod = await signedIn();
    mockFetch(jsonResponse({}, { status: 429 }));

    const error = await mod.apiRequest("/api/mfa/verify").catch((e) => e);

    expect((error as { retryAfterSeconds: number }).retryAfterSeconds).toBe(60);
  });

  it("conserve status, code et données dans l'erreur générique", async () => {
    const mod = await signedIn();
    mockFetch(
      jsonResponse(
        { code: "TAG_DUPLICATE", error: "Tag exists" },
        { status: 409 }
      )
    );

    const error = await mod.apiRequest("/api/tags", { method: "POST" }).catch((e) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as { status: number }).status).toBe(409);
    expect((error as { code: string }).code).toBe("TAG_DUPLICATE");
    expect((error as Error).message).toBe("Tag exists");
  });

  it("rafraîchit la session sur un 401 puis rejoue la requête une seule fois", async () => {
    const mod = await signedIn();
    const fetchMock = mockFetch(
      jsonResponse({ error: "expired" }, { status: 401 }),
      jsonResponse({ session: { access_token: "NEW" } }),
      jsonResponse({ ok: true })
    );

    const result = await mod.apiRequest<{ ok: boolean }>("/api/tags");

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(callUrl(fetchMock, 1)).toBe("/api/auth/refresh");
    expect(callHeaders(fetchMock, 2).get("Authorization")).toBe("Bearer NEW");
  });

  it("ne boucle pas si le 401 persiste après le refresh", async () => {
    const mod = await signedIn();
    const fetchMock = mockFetch(
      jsonResponse({ error: "expired" }, { status: 401 }),
      jsonResponse({ session: { access_token: "NEW" } }),
      jsonResponse({ error: "still expired" }, { status: 401 })
    );

    const error = await mod.apiRequest("/api/tags").catch((e) => e);

    expect((error as { status: number }).status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("vide la session quand le refresh est refusé", async () => {
    const mod = await signedIn();
    mockFetch(
      jsonResponse({ error: "expired" }, { status: 401 }),
      jsonResponse({ error: "invalid refresh" }, { status: 401 })
    );

    await mod.apiRequest("/api/tags").catch(() => undefined);

    expect(mod.getAccessToken()).toBeNull();
  });

  it("ne tente jamais de refresh sur les endpoints d'authentification", async () => {
    const mod = await loadModule();
    const fetchMock = mockFetch(
      jsonResponse({ error: "Invalid credentials" }, { status: 401 })
    );

    const error = await mod.signIn("a@b.c", "bad").catch((e) => e);

    expect((error as { status: number }).status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(callUrl(fetchMock, 0)).toBe("/api/auth/login");
  });

  it("n'impose pas Content-Type JSON sur un FormData", async () => {
    const mod = await signedIn();
    const fetchMock = mockFetch(jsonResponse({ success: true }));
    const body = new FormData();
    body.append("avatar", new Blob(["x"], { type: "image/png" }), "a.png");

    await mod.apiRequest("/api/user/avatar", { method: "POST", body });

    expect(callHeaders(fetchMock, 0).get("Content-Type")).not.toBe("application/json");
  });

  it("transforme un dépassement de délai en TimeoutError", async () => {
    const mod = await signedIn();
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError"))
            );
          })
      )
    );

    const pending = mod.apiRequest("/api/slow").catch((e) => e);
    await vi.advanceTimersByTimeAsync(60_001);
    const error = await pending;

    expect((error as Error).name).toBe("TimeoutError");
  });
});

describe("liens de réinitialisation de mot de passe", () => {
  it("détecte un lien de récupération et en lit les paramètres", async () => {
    const mod = await loadModule();
    window.location.hash = "#access_token=TOK&type=recovery";

    expect(mod.isRecoveryUrl()).toBe(true);
    expect(mod.readRecoveryParams()).toEqual({ accessToken: "TOK" });
  });

  it("lit aussi un token_hash", async () => {
    const mod = await loadModule();
    window.location.hash = "#token_hash=HASH&type=recovery";

    expect(mod.readRecoveryParams()).toEqual({ tokenHash: "HASH" });
  });

  it("ignore une URL qui n'est pas un lien de récupération", async () => {
    const mod = await loadModule();
    window.location.hash = "#access_token=TOK&type=signup";

    expect(mod.isRecoveryUrl()).toBe(false);
    expect(mod.readRecoveryParams()).toBeNull();
  });

  it("traduit un lien expiré en message clair", async () => {
    const mod = await loadModule();
    window.location.hash = "#error_code=otp_expired&error_description=x";

    expect(mod.readRecoveryError()).toContain("expired");
  });
});

describe("tags", () => {
  it("convertit la classe Tailwind en couleur hex pour le backend", async () => {
    const mod = await loadModule();
    mockFetch(jsonResponse({ session: { access_token: "TOKEN" } }));
    await mod.signIn("a@b.c", "pw");
    const fetchMock = mockFetch(
      jsonResponse({ tag: { id: "t1", name: "Promo", color: "#FF8800" } })
    );

    const tag = await mod.createTag("Promo", "bg-[#FF8800]");

    const sent = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(sent).toEqual({ name: "Promo", color: "#ff8800" });
    expect(tag).toEqual({ id: "t1", label: "Promo", color: "bg-[#ff8800]" });
  });

  it("rejette une réponse de tag invalide", async () => {
    const mod = await loadModule();
    mockFetch(jsonResponse({ session: { access_token: "TOKEN" } }));
    await mod.signIn("a@b.c", "pw");
    mockFetch(jsonResponse({ tag: { nope: true } }));

    await expect(mod.createTag("x", "bg-[#000000]")).rejects.toThrow(
      "Invalid tag response"
    );
  });
});
