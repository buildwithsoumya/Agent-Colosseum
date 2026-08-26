"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  globalRole: "ADMIN" | "MENTOR" | "PARTICIPANT" | "SPECTATOR";
  status: "ACTIVE" | "DEACTIVATED";
  createdAt: string;
  team: { id: string; name: string; teamRole: "MEMBER" | "CAPTAIN" } | null;
}

interface TeamOption {
  id: string;
  name: string;
}

export default function AdminUsersPage() {
  const { user } = useSession();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // invite modal state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<"MENTOR" | "CAPTAIN">("MENTOR");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteTeamId, setInviteTeamId] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [u, t] = await Promise.all([
        api.get<{ users: AdminUser[] }>("/api/admin/users"),
        api.get<{ teams: TeamOption[] }>("/api/admin/teams"),
      ]);
      setUsers(u.users);
      setTeams(
        t.teams.map((x) => ({ id: x.id, name: x.name })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act<T = unknown>(path: string, body?: unknown): Promise<T | null> {
    setError(null);
    setMessage(null);
    try {
      const res = await api.post<T>(path, body);
      await load();
      return res;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
      return null;
    }
  }

  async function deactivate(id: string) {
    await act(`/api/admin/users/${id}/deactivate`);
    setMessage("User deactivated.");
  }
  async function activate(id: string) {
    await act(`/api/admin/users/${id}/activate`);
    setMessage("User activated.");
  }
  async function changeRole(id: string, role: string) {
    await act(`/api/admin/users/${id}/role`, { role });
    setMessage("Global role updated.");
  }
  async function makeCaptain(teamId: string, userId: string) {
    await act(`/api/admin/teams/${teamId}/captain`, { userId });
    setMessage("Team captain set.");
  }
  async function clearCaptain(teamId: string) {
    setError(null);
    setMessage(null);
    try {
      await api.delete(`/api/admin/teams/${teamId}/captain`);
      await load();
      setMessage("Team captain removed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  }

  async function createInvite() {
    setError(null);
    setMessage(null);
    try {
      const body = inviteRole === "CAPTAIN" ? { email: inviteEmail, role: inviteRole, teamId: inviteTeamId } : { email: inviteEmail, role: inviteRole };
      const res = await api.post<{ invitation: { link: string } }>("/api/admin/invitations", body);
      setInviteLink(res.invitation.link);
      setInviteEmail("");
      setInviteTeamId("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create invitation");
    }
  }

  return (
    <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">User management</h1>
            <p className="mt-1 text-[13px] text-ink-soft">
              Participants, mentors and admins. Global roles are assigned server-side; privileged roles are issued by invitation.
            </p>
          </div>
          <Button onClick={() => { setInviteOpen(true); setInviteLink(null); }}>Invite user</Button>
        </div>

        {(error || message) && (
          <p className={`border px-4 py-2 font-mono text-[11px] uppercase tracking-wider ${error ? "border-bad/40 bg-bad-soft text-bad" : "border-good/40 bg-good-soft text-good"}`}>
            {error ? `[ ERROR ] ${error}` : `[ OK ] ${message}`}
          </p>
        )}

        <Card>
          <CardHeader><CardTitle>Accounts</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                    <th className="px-4 py-2">User</th>
                    <th className="px-4 py-2">Global role</th>
                    <th className="px-4 py-2">Team</th>
                    <th className="px-4 py-2">Team role</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Created</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-line transition-colors last:border-0 hover:bg-module">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-ink">{u.name}</p>
                        <p className="font-mono text-[10px] text-ink-soft">{u.email}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={u.globalRole === "ADMIN" ? "accent" : u.globalRole === "MENTOR" ? "good" : "neutral"}>{u.globalRole}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-ink">{u.team?.name ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        {u.team?.teamRole === "CAPTAIN" ? <Badge tone="accent">Captain</Badge> : u.team ? "Member" : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={u.status === "ACTIVE" ? "good" : "bad"}>{u.status === "ACTIVE" ? "Active" : "Deactivated"}</Badge>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[10px] text-ink-soft">{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {u.status === "ACTIVE" ? (
                            <Button size="sm" variant="outline" onClick={() => deactivate(u.id)} disabled={u.id === user?.id}>Deactivate</Button>
                          ) : (
                            <Button size="sm" variant="good" onClick={() => activate(u.id)}>Activate</Button>
                          )}
                          {u.globalRole !== "ADMIN" && u.globalRole !== "MENTOR" && (
                            <Button size="sm" variant="outline" onClick={() => changeRole(u.id, "MENTOR")}>Make mentor</Button>
                          )}
                          {u.globalRole === "MENTOR" && (
                            <Button size="sm" variant="outline" onClick={() => changeRole(u.id, "PARTICIPANT")}>Make participant</Button>
                          )}
                          {u.team && (
                            u.team.teamRole === "CAPTAIN" ? (
                              <Button size="sm" variant="danger" onClick={() => clearCaptain(u.team!.id)}>Remove captain</Button>
                            ) : (
                              <Button size="sm" variant="accentSoft" onClick={() => makeCaptain(u.team!.id, u.id)}>Set captain</Button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite a user">
        {inviteLink ? (
          <div className="space-y-4">
            <p className="text-sm text-ink">
              Send this one-time invitation link to the invitee. It expires after 7 days and can only be used once.
            </p>
            <div className="break-all border border-line bg-void px-3 py-2 font-mono text-[11px] text-accent">{inviteLink}</div>
            <Button className="w-full" onClick={() => { setInviteLink(null); setInviteOpen(false); }}>Done</Button>
          </div>
        ) : (
          <div className="space-y-3.5">
            <p className="text-[13px] text-ink-soft">
              Select a privileged role. Invitees complete account setup themselves; the server assigns the role from the invitation.
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {(["MENTOR", "CAPTAIN"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setInviteRole(r)}
                  className={`rounded-[0.125rem] border px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors ${inviteRole === r ? "border-accent bg-accent/15 text-accent" : "border-line text-ink-soft hover:text-ink"}`}
                >
                  {r === "MENTOR" ? "Mentor" : "Team Captain"}
                </button>
              ))}
            </div>
            <Input type="email" placeholder="Invitee email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            {inviteRole === "CAPTAIN" && (
              <select
                value={inviteTeamId}
                onChange={(e) => setInviteTeamId(e.target.value)}
                className="h-10 w-full rounded-[0.125rem] border border-line bg-void px-2 text-xs text-ink focus:border-accent focus:outline-none"
              >
                <option value="">Team…</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
            {error && <p className="border border-bad/40 bg-bad-soft px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-bad">{error}</p>}
            <Button
              className="w-full"
              disabled={!inviteEmail || (inviteRole === "CAPTAIN" && !inviteTeamId)}
              onClick={createInvite}
            >
              Generate invitation
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}