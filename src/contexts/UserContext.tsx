import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
  refreshUser: () => Promise<UserProfile | null>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

/** Préfixe des clés de session stockées dans localStorage. */
const STORAGE_PREFIX = "crossflow_";

/** Clés de tokens utilisées par l'app (doivent matcher services/stripe.ts). */
const ACCESS_TOKEN_KEY = "crossflow_access_token";
const REFRESH_TOKEN_KEY = "crossflow_refresh_token";

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Récupère l'utilisateur actuellement connecté et son profil.
   * getCurrentUser() renvoie null si aucune session n'est stockée
   * ou si elle est invalide (le refresh du token est géré automatiquement).
   */
  const refreshUser = useCallback(async (): Promise<UserProfile | null> => {
    try {
      const userData = await getCurrentUser();
      setUser(userData);
      return userData;
    } catch (error) {
      console.error("Error refreshing user:", error);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Vérification initiale de la session au démarrage.
   *
   * IMPORTANT : `consumeOAuthRedirect()` doit être appelé AVANT
   * `getCurrentUser()` afin de traiter un éventuel retour OAuth
   * (échange du code PKCE, pose des tokens, nettoyage de l'URL).
   */
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const oauth = await consumeOAuthRedirect(); // ← AVANT getCurrentUser
        const userData = await getCurrentUser();

        if (!mounted) return;

        setUser(userData);

        if (oauth === "ready" && userData) {
          navigate("home"); // ← redirection directe post-login OAuth
        }
        // oauth === "mfa" : getCurrentUser() renvoie null tant que le MFA est
        // en attente ; envoie ici vers ton écran de challenge 2FA
        // (ex : navigate("signin")) selon ta logique actuelle.
      } catch (error) {
        console.error("Error initializing authentication:", error);

        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
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
   * Événement émis par `clearStoredTokens()` dans services/stripe.ts :
   *   window.dispatchEvent(new CustomEvent("stone:auth-expired"))
   */
  useEffect(() => {
    const handleAuthExpired = () => {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      setUser(null);
      setLoading(false);
    };

    window.addEventListener("stone:auth-expired", handleAuthExpired);

    return () => {
      window.removeEventListener("stone:auth-expired", handleAuthExpired);
    };
  }, []);

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
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