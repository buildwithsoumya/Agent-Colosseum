"use client";

import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { RequireRole } from "@/components/auth/require-role";
import { DashboardShell } from "@/components/dashboard/shell";
import { PhaseHeader } from "@/components/event/phase-header";

const PARTICIPANT_NAV = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/team", label: "Team" },
  { href: "/app/tasks", label: "Tasks" },
  { href: "/app/store", label: "Store" },
  { href: "/app/arena", label: "Arena" },
  { href: "/app/casino", label: "Casino" },
  { href: "/app/submission", label: "Submit" },
  { href: "/app/wallet", label: "Wallet" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, team, logout } = useSession();
  const router = useRouter();

  return (
    <RequireRole roles={["PARTICIPANT"]}>
      <DashboardShell
        brand={"PARTICIPANT" + "ARENA"}
        accentWord="ARENA"
        nav={PARTICIPANT_NAV}
        userName={user?.name}
        teamName={team?.name ?? "NO TEAM YET"}
        captain={team?.isCaptain ?? false}
        onLogout={() => logout().then(() => router.push("/"))}
      >
        <PhaseHeader />
        {children}
      </DashboardShell>
    </RequireRole>
  );
}