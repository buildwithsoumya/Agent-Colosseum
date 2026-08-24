"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { PublicUser } from "@ac/shared";

interface SessionValue {
  user: PublicUser | null;
  team: { id: string; name: string; isCaptain: boolean } | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<PublicUser>;
  register: (name: string, email: string, password: string) => Promise<PublicUser>;
  logout: () => Promise<void>;
}

const Ctx = createContext<SessionValue>({} as SessionValue);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [team, setTeam] = useState<SessionValue["team"]>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<{ user: PublicUser; team: SessionValue["team"] }>("/api/auth/me");
      setUser(data.user);
      setTeam(data.team);
    } catch {
      setUser(null);
      setTeam(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      team,
      loading,
      refresh,
      async login(email, password) {
        const data = await api.post<{ user: PublicUser }>("/api/auth/login", { email, password });
        await refresh();
        return data.user;
      },
      async register(name, email, password) {
        const data = await api.post<{ user: PublicUser }>("/api/auth/register", { name, email, password });
        await refresh();
        return data.user;
      },
      async logout() {
        await api.post("/api/auth/logout");
        setUser(null);
        setTeam(null);
      },
    }),
    [user, team, loading, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
