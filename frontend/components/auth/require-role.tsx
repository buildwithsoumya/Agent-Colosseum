"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@ac/shared";
import { useSession } from "@/lib/session";
import { AccessRestricted } from "./access-restricted";

/** The authenticated landing page for a given global role. */
export function roleHome(role: Role | undefined): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "MENTOR":
      return "/mentor";
    default:
      return "/app";
  }
}

/**
 * Server-verified role gate. Renders children only when the authenticated
 * user's global role (from /api/auth/me) matches an allowed role. While the
 * session is resolving it shows a loading state — never a flash of the wrong
 * dashboard. An authenticated user with the wrong role gets a proper 403 page.
 */
export function RequireRole({
  roles,
  children,
}: {
  roles: Role[];
  children: React.ReactNode;
}) {
  const { user, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center tech-grid">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
          <span className="mr-2 text-accent">&gt;</span> Checking credentials…
        </p>
      </div>
    );
  }

  if (!user) return null; // effect redirects
  if (!roles.includes(user.role)) {
    return (
      <AccessRestricted
        onRetry={() => router.replace(roleHome(user.role))}
      />
    );
  }
  return <>{children}</>;
}