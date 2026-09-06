import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AuthUser } from "@mankopi/shared";
import { api, clearTokens, getAccessToken, getRefreshToken, setAccessToken, setTokens } from "./api";

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  reload: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

async function applySession(user: AuthUser, accessToken: string) {
  const refresh = getRefreshToken();
  if (refresh) setTokens(accessToken, refresh);
  else setAccessToken(accessToken);
  return user;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getAccessToken()) {
      setLoading(false);
      return;
    }
    api
      .reissue()
      .then(async (result) => {
        setUser(await applySession(result.user, result.accessToken));
      })
      .catch(() => {
        clearTokens();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login: async (email, password) => {
        const result = await api.login(email, password);
        setTokens(result.accessToken, result.refreshToken);
        setUser(result.user);
      },
      logout: () => {
        clearTokens();
        setUser(null);
      },
      reload: async () => {
        const result = await api.reissue();
        setUser(await applySession(result.user, result.accessToken));
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("AuthProvider required");
  return ctx;
}
