"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { PublicUser } from "@ac/shared";

interface SessionValue {
  user: PublicUser | null;
  team: { id: string; name: string; isCaptain: boolean; teamRole: "MEMBER" | "CAPTAIN" | null } | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<PublicUser>;
  register: (name: string, email: string, password: string, confirmPassword: string) => Promise<PublicUser>;
  registerInvitation: (args: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
    invitationToken: string;
  }) => Promise<{ user: PublicUser; teamRole: string | null }>;
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
      async register(name, email, password, confirmPassword) {
        const data = await api.post<{ user: PublicUser }>("/api/auth/register", {
          name,
          email,
          password,
          confirmPassword,
        });
        await refresh();
        return data.user;
      },
      async registerInvitation({ name, email, password, confirmPassword, invitationToken }) {
        const data = await api.post<{ user: PublicUser; teamRole: string | null }>("/api/auth/register/invitation", {
          name,
          email,
          password,
          confirmPassword,
          invitationToken,
        });
        await refresh();
        return data;
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
