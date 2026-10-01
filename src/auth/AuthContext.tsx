import NetInfo from "@react-native-community/netinfo";
import { usePathname, useRouter } from "expo-router";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ApiError,
  AuthUser,
  getAuthToken,
  getMe,
  login,
  register,
  removeAuthToken,
  saveAuthToken,
  updateMe,
} from "@/services/api";
import {
  clearActiveAccount,
  clearSavedSignedInUser,
  claimExistingTodosForAccount,
  initDatabase,
  getSignedInUser,
  saveSignedInUser,
  setActiveAccount,
} from "@/db/database";
import { syncNow } from "@/db/sync";
import type { PropsWithChildren } from "react";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  signInWithCredentials: (
    identifier: string,
    password: string,
  ) => Promise<AuthUser>;
  registerAccount: (
    username: string,
    email: string,
    password: string,
  ) => Promise<AuthUser>;
  refreshUser: () => Promise<AuthUser | null>;
  updateProfile: (username: string, email: string) => Promise<AuthUser>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const establishLocalAccount = async (nextUser: AuthUser) => {
    await setActiveAccount(nextUser.id);
    await claimExistingTodosForAccount(nextUser.id);
  };

  const finishSignIn = async (token: string, nextUser: AuthUser) => {
    await saveAuthToken(token);
    await saveSignedInUser(nextUser);
    await establishLocalAccount(nextUser);
    setUser(nextUser);

    // A successful sign-in is the point at which old unowned device todos
    // become associated with this backend account. Sync is best-effort.
    await syncNow();
  };

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        await initDatabase();

        const token = await getAuthToken();
        const cachedUser = await getSignedInUser();

        if (!token) {
          if (!cancelled) setUser(null);
          return;
        }

        try {
          const response = await getMe();
          if (cancelled) return;

          await saveSignedInUser(response.user);
          await establishLocalAccount(response.user);
          setUser(response.user);
          await syncNow();
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            await removeAuthToken();
            await clearActiveAccount();
            await clearSavedSignedInUser();
            if (!cancelled) setUser(null);
          } else if (cachedUser && !cancelled) {
            // Offline startup: retain the existing authenticated session and
            // use the local cache until the API is reachable again.
            await establishLocalAccount(cachedUser);
            setUser(cachedUser);
          } else if (!cancelled) {
            setUser(null);
          }
        }
      } catch (error) {
        console.error("Failed to restore authentication:", error);
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        void syncNow();
      }
    });

    return unsubscribe;
  }, [user?.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,

      async signInWithCredentials(identifier, password) {
        const response = await login(identifier, password);
        await finishSignIn(response.token, response.user);
        return response.user;
      },

      async registerAccount(username, email, password) {
        const response = await register(username, email, password);
        await finishSignIn(response.token, response.user);
        return response.user;
      },

      async refreshUser() {
        try {
          const response = await getMe();
          await saveSignedInUser(response.user);
          await establishLocalAccount(response.user);
          setUser(response.user);
          return response.user;
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            await removeAuthToken();
            await clearActiveAccount();
            await clearSavedSignedInUser();
            setUser(null);
          }
          return null;
        }
      },

      async updateProfile(username, email) {
        const response = await updateMe(username, email);
        await saveSignedInUser(response.user);
        await establishLocalAccount(response.user);
        setUser(response.user);
        return response.user;
      },

      async signOut() {
        await removeAuthToken();
        await clearActiveAccount();
        await clearSavedSignedInUser();
        setUser(null);

        if (pathname !== "/login" && pathname !== "/signup") {
          router.replace("/login");
        }
      },
    }),
    [loading, pathname, router, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return value;
}
