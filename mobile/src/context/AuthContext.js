import { createContext, useContext, useMemo, useState } from "react";

import * as api from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: !!token,
      async login(email, password) {
        const data = await api.login(email, password);
        setUser(data.user);
        setToken(data.session?.access_token ?? null);
      },
      async register(email, password) {
        const data = await api.register(email, password);
        setUser(data.user);
        setToken(data.session?.access_token ?? null);
      },
      async logout() {
        if (token) {
          await api.logout(token).catch(() => {});
        }
        setUser(null);
        setToken(null);
      },
    }),
    [user, token]
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
