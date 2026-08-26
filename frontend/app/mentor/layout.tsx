"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/session";
import { RequireRole } from "@/components/auth/require-role";
import { DashboardShell } from "@/components/dashboard/shell";

const MENTOR_NAV = [
  { href: "/mentor", label: "Reviews" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export default function MentorLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useSession();
  const router = useRouter();

  return (
    <RequireRole roles={["MENTOR", "ADMIN"]}>
      <DashboardShell
        brand={"MENTOR" + "DESK"}
        accentWord="DESK"
        nav={MENTOR_NAV}
        userName={user?.name}
        rightSlot={
          <Link
            href="/spectator"
            className="hidden rounded-[0.125rem] border border-line px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-accent transition-colors hover:border-accent hover:text-ink sm:block"
          >
            Stage view →
          </Link>
        }
        onLogout={() => logout().then(() => router.push("/"))}
      >
        {children}
      </DashboardShell>
    </RequireRole>
  );
}