import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import * as api from "../api/client";
import { identifyPurchasesUser, signOutPurchasesUser } from "../services/purchases";
import { clearTokens, loadStoredTokens, saveTokens } from "./tokenStorage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [plan, setPlan] = useState("free");
  const [premiumExpiresAt, setPremiumExpiresAt] = useState(null);
  const [limit, setLimit] = useState(null);
  const refreshTokenRef = useRef(null);
  const tokenRef = useRef(null);

  function applySession(session, sessionUser) {
    refreshTokenRef.current = session?.refresh_token ?? null;
    tokenRef.current = session?.access_token ?? null;
    setToken(session?.access_token ?? null);
    setUser(sessionUser ?? null);
  }

  function applyMeData(data) {
    setUser(data.user);
    setPlan(data.plan);
    setPremiumExpiresAt(data.premium_expires_at);
    setLimit(data.limit);
  }

  // Güncel /auth/me verisini döner; başarısız olursa null döner.
  async function refreshPlan(activeToken) {
    const effectiveToken = activeToken || tokenRef.current;
    if (!effectiveToken) {
      return null;
    }
    try {
      const data = await api.me(effectiveToken);
      applyMeData(data);
      return data;
    } catch (err) {
      // Yok say; mevcut plan bilgisi ekranda kalmaya devam eder.
      return null;
    }
  }

  async function clearSession() {
    refreshTokenRef.current = null;
    tokenRef.current = null;
    setToken(null);
    setUser(null);
    setPlan("free");
    setPremiumExpiresAt(null);
    setLimit(null);
    await clearTokens().catch(() => {});
    await signOutPurchasesUser();
  }

  useEffect(() => {
    api.configureAuthClient({
      getRefreshToken: () => refreshTokenRef.current,
      onTokenRefreshed: (session) => {
        refreshTokenRef.current = session?.refresh_token ?? refreshTokenRef.current;
        tokenRef.current = session?.access_token ?? null;
        setToken(session?.access_token ?? null);
        saveTokens({
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
        }).catch(() => {});
      },
      onSessionExpired: () => {
        clearSession();
      },
    });

    (async () => {
      const { accessToken, refreshToken } = await loadStoredTokens().catch(() => ({
        accessToken: null,
        refreshToken: null,
      }));

      if (!accessToken || !refreshToken) {
        setAuthReady(true);
        return;
      }

      refreshTokenRef.current = refreshToken;
      tokenRef.current = accessToken;

      try {
        // api.me 401 alıp token'ı yenilerse onTokenRefreshed tokenRef'i
        // günceller; bu yüzden eski accessToken yerine tokenRef'teki güncel
        // değeri state'e yazıyoruz.
        const data = await api.me(accessToken);
        setToken(tokenRef.current);
        applyMeData(data);
        await identifyPurchasesUser(data.user.id);
      } catch (err) {
        await clearSession();
      } finally {
        setAuthReady(true);
      }
    })();
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      authReady,
      plan,
      premiumExpiresAt,
      limit,
      isAuthenticated: !!token,
      isPremium: plan === "premium",
      async login(email, password) {
        const data = await api.login(email, password);
        applySession(data.session, data.user);
        if (data.session) {
          await saveTokens({
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
          });
        }
        await identifyPurchasesUser(data.user.id);
        await refreshPlan(data.session?.access_token);
      },
      async register(email, password) {
        const data = await api.register(email, password);
        applySession(data.session, data.user);
        if (data.session) {
          await saveTokens({
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
          });
        }
        await identifyPurchasesUser(data.user.id);
        await refreshPlan(data.session?.access_token);
      },
      async logout() {
        if (token) {
          await api.logout(token).catch(() => {});
        }
        await clearSession();
      },
      async deleteAccount() {
        await api.deleteAccount(token);
        await clearSession();
      },
      refreshPlan,
    }),
    [user, token, authReady, plan, premiumExpiresAt, limit]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth, AuthProvider içinde kullanılmalı");
  }
  return ctx;
}
