import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { navigate } from "../hooks/useHashRoute";
import {
  getCurrentUser,
  consumeOAuthRedirect,
  type UserProfile,
} from "../services/supabase";

interface UserContextType {
  user: UserProfile | null;
  loading: boolean;
  authError: boolean;
  refreshUser: () => Promise<UserProfile | null>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

/** Préfixe historique des clés de session (migration uniquement). */
const STORAGE_PREFIX = "crossflow_";

/** Clés de tokens utilisées par l'app (doivent matcher services/stripe.ts). */
const ACCESS_TOKEN_KEY = "crossflow_access_token";
const REFRESH_TOKEN_KEY = "crossflow_refresh_token";

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const authVersionRef = useRef(0);
  const hiddenAtRef = useRef(0);
  const lastResumeCheckAtRef = useRef(0);

  /**
   * Récupère l'utilisateur sans transformer une panne réseau en déconnexion.
   * Si un utilisateur est déjà chargé, l'UI reste disponible pendant le check.
   */
  const refreshUser = useCallback(async (): Promise<UserProfile | null> => {
    const requestVersion = authVersionRef.current;
    if (!user) setLoading(true);
    setAuthError(false);

    try {
      const userData = await getCurrentUser({ throwOnError: true });
      if (requestVersion !== authVersionRef.current) return null;
      setUser(userData);
      setAuthError(false);
      return userData;
    } catch (error) {
      if (requestVersion !== authVersionRef.current) return null;
      console.error("Error refreshing user:", error);
      setAuthError(true);
      return user;
    } finally {
      if (requestVersion === authVersionRef.current) {
        setLoading(false);
      }
    }
  }, [user]);

  /**
   * Vérification initiale de la session au démarrage.
   *
   * IMPORTANT : `consumeOAuthRedirect()` doit être appelé AVANT
   * `getCurrentUser()` afin de traiter un éventuel retour OAuth
   * (échange du code PKCE, pose des tokens, nettoyage de l'URL).
   */
  useEffect(() => {
    let mounted = true;
    const requestVersion = authVersionRef.current;

    const initializeAuth = async () => {
      try {
        const oauth = await consumeOAuthRedirect(); // ← AVANT getCurrentUser
        const userData = await getCurrentUser({ throwOnError: true });

        if (!mounted || requestVersion !== authVersionRef.current) return;

        setUser(userData);
        setAuthError(false);

        if (oauth === "ready" && userData) {
          navigate("home"); // ← redirection directe post-login OAuth
        }
        // oauth === "mfa" : getCurrentUser() renvoie null tant que le MFA est
        // en attente ; envoie ici vers ton écran de challenge 2FA
        // (ex : navigate("signin")) selon ta logique actuelle.
      } catch (error) {
        console.error("Error initializing authentication:", error);

        if (mounted && requestVersion === authVersionRef.current) {
          setAuthError(true);
        }
      } finally {
        if (mounted && requestVersion === authVersionRef.current) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, []);

  /**
   * Synchronisation entre onglets : l'événement "storage" ne se déclenche
   * que dans les AUTRES onglets quand les tokens changent
   * (connexion, déconnexion, refresh).
   */
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      // event.key === null : localStorage.clear() a été appelé
      if (event.key === null || event.key.startsWith(STORAGE_PREFIX)) {
        authVersionRef.current += 1;
        void refreshUser();
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [refreshUser]);

  /**
   * Session expirée signalée par les services API (ex. stripe.ts reçoit
   * un 401 du backend). On vide l'utilisateur et les tokens obsolètes
   * pour que l'UI reflète immédiatement l'état réel (isLoggedIn = false)
   * au lieu de garder un `user` fantôme qui provoque des erreurs en
   * cascade au clic suivant.
   *
   * Événement émis par `clearSession()` et `clearStoredTokens()` :
   *   window.dispatchEvent(new CustomEvent("stone:auth-expired"))
   */
  useEffect(() => {
    const handleAuthExpired = () => {
      authVersionRef.current += 1;
      try {
        sessionStorage.removeItem(ACCESS_TOKEN_KEY);
        sessionStorage.removeItem(REFRESH_TOKEN_KEY);
        // Nettoie aussi les anciennes sessions migrées depuis localStorage.
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      } catch {
        // ignore unavailable browser storage
      }
      setUser(null);
      setAuthError(false);
      setLoading(false);
    };

    window.addEventListener("stone:auth-expired", handleAuthExpired);

    return () => {
      window.removeEventListener("stone:auth-expired", handleAuthExpired);
    };
  }, []);

  /**
   * Une pause d'onglet peut dépasser l'expiration de l'access token. Vérifie
   * la session au retour, sans bloquer l'interface déjà montée.
   */
  useEffect(() => {
    const markHidden = () => {
      hiddenAtRef.current = Date.now();
    };

    const handleResume = () => {
      if (document.visibilityState === "hidden") {
        markHidden();
        return;
      }

      if (!hiddenAtRef.current) return;
      const awayFor = Date.now() - hiddenAtRef.current;
      hiddenAtRef.current = 0;

      if (
        !user ||
        awayFor < 60_000 ||
        Date.now() - lastResumeCheckAtRef.current < 30_000
      ) {
        return;
      }

      lastResumeCheckAtRef.current = Date.now();
      void refreshUser();
    };

    document.addEventListener("visibilitychange", handleResume);
    window.addEventListener("pagehide", markHidden);
    window.addEventListener("pageshow", handleResume);
    window.addEventListener("blur", markHidden);
    window.addEventListener("focus", handleResume);

    return () => {
      document.removeEventListener("visibilitychange", handleResume);
      window.removeEventListener("pagehide", markHidden);
      window.removeEventListener("pageshow", handleResume);
      window.removeEventListener("blur", markHidden);
      window.removeEventListener("focus", handleResume);
    };
  }, [refreshUser, user]);

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        authError,
        refreshUser,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);

  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }

  return context;
}