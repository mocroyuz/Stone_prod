import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { getCurrentUser, type UserProfile } from "../services/supabase";

interface UserContextType {
  user: UserProfile | null;
  loading: boolean;
  refreshUser: () => Promise<UserProfile | null>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

/** Préfixe des clés de session stockées dans localStorage. */
const STORAGE_PREFIX = "crossflow_";

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
   */
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const userData = await getCurrentUser();

        if (mounted) {
          setUser(userData);
        }
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