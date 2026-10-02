import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import * as api from "../api/client";
import { syncGuestSubscriptions } from "../services/guestSync";
import { identifyPurchasesUser, signOutPurchasesUser } from "../services/purchases";
import { clearGuestSubscriptions } from "../storage/guestSubscriptions";
import { clearTokens, loadStoredTokens, saveTokens } from "./tokenStorage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [plan, setPlan] = useState("free");
  const [premiumExpiresAt, setPremiumExpiresAt] = useState(null);
  const [limit, setLimit] = useState(null);
  const [subscriptionCount, setSubscriptionCount] = useState(0);
  // Açılışta misafir listesi aktarılırken limite takılındıysa Ana sayfa
  // Paywall'ı bir kez açar (bkz. HomeScreen).
  const [pendingPaywall, setPendingPaywall] = useState(false);
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
    setSubscriptionCount(data.subscription_count ?? 0);
  }

  // Giriş/kayıt sonrası (ve açılışta) misafir listesini hesaba aktarır.
  // Aktarım bir şey eklediyse plan/sayı bilgisini tazeler.
  async function mergeGuestSubscriptions(activeToken) {
    const result = await syncGuestSubscriptions(activeToken);
    if (result && !result.error) {
      await refreshPlan(activeToken);
    }
    return result;
  }

  async function afterSignIn(data) {
    applySession(data.session, data.user);
    if (data.session) {
      await saveTokens({
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
      });
    }
    await identifyPurchasesUser(data.user.id);
    const me = await refreshPlan(data.session?.access_token);
    const guestSync = await mergeGuestSubscriptions(data.session?.access_token);
    return { plan: me?.plan ?? "free", guestSync };
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
    setSubscriptionCount(0);
    setPendingPaywall(false);
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

        // Önceki aktarım ağ hatasıyla kalmışsa burada tekrar denenir.
        const guestSync = await mergeGuestSubscriptions(tokenRef.current);
        if (guestSync?.limit_reached && data.plan !== "premium") {
          setPendingPaywall(true);
        }
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
      subscriptionCount,
      pendingPaywall,
      consumePendingPaywall() {
        setPendingPaywall(false);
      },
      isAuthenticated: !!token,
      isPremium: plan === "premium",
      // login/register: { plan, guestSync } döner. guestSync, misafir
      // listesinin aktarım sonucudur (liste boşsa null).
      async login(email, password) {
        const data = await api.login(email, password);
        return afterSignIn(data);
      },
      async register(email, password) {
        const data = await api.register(email, password);
        return afterSignIn(data);
      },
      async logout() {
        if (token) {
          await api.logout(token).catch(() => {});
        }
        await clearSession();
      },
      async deleteAccount() {
        await api.deleteAccount(token);
        // Misafire dönüşte bu cihazdaki liste boş başlasın.
        await clearGuestSubscriptions().catch(() => {});
        await clearSession();
      },
      refreshPlan,
    }),
    [user, token, authReady, plan, premiumExpiresAt, limit, subscriptionCount, pendingPaywall]
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
