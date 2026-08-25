"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

interface ManagedUser {
  id: string;
  name: string;
  email: string;
  globalRole: "ADMIN" | "MENTOR" | "PARTICIPANT";
  status: "ACTIVE" | "SUSPENDED";
  createdAt: string;
  team: { id: string; name: string; teamRole: "MEMBER" | "CAPTAIN" } | null;
}

interface InvitationRow {
  id: string;
  email: string;
  role: string;
  teamName: string | null;
  status: string;
  expiresAt: string;
}

const roleTone = (r: string): "ink" | "accent" | "neutral" => (r === "ADMIN" ? "ink" : r === "MENTOR" ? "accent" : "neutral");

export function UserManagement({ teams }: { teams: Array<{ id: string; name: string }> }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [invites, setInvites] = useState<InvitationRow[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"MENTOR" | "CAPTAIN">("MENTOR");
  const [inviteTeamId, setInviteTeamId] = useState("");
  const [issuedLink, setIssuedLink] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [u, i] = await Promise.all([
        api.get<{ users: ManagedUser[] }>("/api/admin/users"),
        api.get<{ invitations: InvitationRow[] }>("/api/admin/users/invites"),
      ]);
      setUsers(u.users);
      setInvites(i.invitations);
    } catch {
      /* unauthenticated */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createInvite() {
    setMessage(null);
    try {
      const r = await api.post<{ inviteUrl: string; invitation: { expiresAt: string } }>(
        "/api/admin/users/invite",
        {
          email: inviteEmail,
          role: inviteRole,
          ...(inviteRole === "CAPTAIN" && inviteTeamId ? { teamId: inviteTeamId } : {}),
        },
      );
      // show once — the raw token is never stored server-side
      setIssuedLink(`${window.location.origin}${r.inviteUrl}`);
      setInviteEmail("");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Invite failed");
    }
  }

  async function act(path: string, body?: unknown, okMessage?: string) {
    setMessage(null);
    try {
      await api.patch(path, body).catch(() => api.post(path, body));
      if (okMessage) setMessage(okMessage);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Action failed");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>User management</CardTitle>
        <Button size="sm" variant="accentSoft" onClick={() => { setInviteOpen(true); setIssuedLink(null); }}>
          Invite user
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-96 overflow-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="sticky top-0 border-b border-line bg-paper-dim text-[11px] uppercase tracking-wider text-ink-soft">
              <tr>
                <th className="px-4 py-2.5 font-semibold">User</th>
                <th className="px-4 py-2.5 font-semibold">Global role</th>
                <th className="px-4 py-2.5 font-semibold">Team</th>
                <th className="px-4 py-2.5 font-semibold">Team role</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map((u) => (
                <tr key={u.id} className={u.status === "SUSPENDED" ? "opacity-50" : undefined}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{u.name}</p>
                    <p className="text-[11px] text-neutral-400">{u.email}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={roleTone(u.globalRole)}>{u.globalRole}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-[13px]">{u.team?.name ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {u.team ? (
                      u.team.teamRole
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={u.status === "ACTIVE" ? "good" : "bad"}>{u.status}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                    {/* ADMIN rows are intentionally action-less */}
                    {u.globalRole !== "ADMIN" && (
                      <>
                        {u.globalRole === "PARTICIPANT" && (
                          <button
                            onClick={() => act(`/api/admin/users/${u.id}/global-role`, { role: "MENTOR" }, `${u.name} is now a mentor`)}
                            className="mr-2 rounded px-1.5 py-1 text-[11px] font-semibold text-accent hover:bg-accent-soft"
                          >
                            Make mentor
                          </button>
                        )}
                        {u.globalRole === "MENTOR" && (
                          <button
                            onClick={() => act(`/api/admin/users/${u.id}/global-role`, { role: "PARTICIPANT" }, `${u.name} is now a participant`)}
                            className="mr-2 rounded px-1.5 py-1 text-[11px] font-semibold text-ink-soft hover:bg-paper-dim"
                          >
                            To participant
                          </button>
                        )}
                        {u.team && (
                          <button
                            onClick={() =>
                              act(
                                `/api/admin/teams/${u.team!.id}/captain`,
                                { userId: u.id, action: u.team!.teamRole === "CAPTAIN" ? "REMOVE" : "ASSIGN" },
                                `Captain updated for ${u.team!.name}`,
                              )
                            }
                            className="mr-2 rounded px-1.5 py-1 text-[11px] font-semibold text-accent hover:bg-accent-soft"
                          >
                            {u.team.teamRole === "CAPTAIN" ? "Remove captain" : "Make captain"}
                          </button>
                        )}
                        <button
                          onClick={() =>
                            act(`/api/admin/users/${u.id}/status`, { status: u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" })
                          }
                          className="rounded px-1.5 py-1 text-[11px] font-semibold text-bad hover:bg-red-50"
                        >
                          {u.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {invites.length > 0 && (
          <div className="border-t border-line px-4 py-3">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">Recent invitations</p>
            <ul className="space-y-1">
              {invites.slice(0, 6).map((i) => (
                <li key={i.id} className="flex items-center justify-between text-[12px]">
                  <span className="truncate">
                    {i.email} · <span className="text-ink-soft">{i.role}{i.teamName ? ` (${i.teamName})` : ""}</span>
                  </span>
                  <Badge tone={i.status === "USED" ? "good" : i.status === "PENDING" ? "accent" : "neutral"}>{i.status}</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}

        {message && <p className="border-t border-line px-4 py-2 text-xs font-medium text-accent-strong">{message}</p>}
      </CardContent>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite a privileged user">
        {issuedLink ? (
          <div className="space-y-3">
            <p className="text-sm text-good">Invitation created. Share this single-use link — it will not be shown again:</p>
            <code className="block break-all rounded-lg bg-paper-dim px-3 py-2 font-mono text-xs">{issuedLink}</code>
            <Button onClick={() => setInviteOpen(false)} className="w-full bg-accent hover:bg-accent-strong">
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-3.5">
            <Input type="email" placeholder="Invitee email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Role to grant</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "MENTOR" | "CAPTAIN")}
                className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm focus:border-accent focus:outline-none"
              >
                <option value="MENTOR">Mentor</option>
                <option value="CAPTAIN">Team Captain</option>
              </select>
              <p className="mt-1 text-[11px] text-neutral-400">Admin accounts are provisioned manually and can never be invited.</p>
            </div>
            {inviteRole === "CAPTAIN" && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Team</label>
                <select
                  value={inviteTeamId}
                  onChange={(e) => setInviteTeamId(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm focus:border-accent focus:outline-none"
                >
                  <option value="">Select team…</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}
            <Button
              onClick={createInvite}
              disabled={!inviteEmail.includes("@") || (inviteRole === "CAPTAIN" && !inviteTeamId)}
              className="w-full bg-accent hover:bg-accent-strong"
            >
              Generate secure invitation (72h, single use)
            </Button>
          </div>
        )}
      </Modal>
    </Card>
  );
}
