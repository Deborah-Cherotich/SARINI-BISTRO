import { createContext, useContext, useState, type ReactNode } from "react";
import { api } from "../api";
import { getStoredUser, setAuth, clearAuth } from "../authStorage";
import type { AuthUser } from "../types";

interface AuthContextValue {
  user: AuthUser | null;
  login: (username: string, password: string, remember: boolean) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadStoredUser(): AuthUser | null {
  const raw = getStoredUser();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadStoredUser());

  async function login(username: string, password: string, remember: boolean) {
    const data = await api.post<{ token: string; user: AuthUser }>("/auth/login", {
      username,
      password,
    });
    setAuth(data.token, JSON.stringify(data.user), remember);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    clearAuth();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
