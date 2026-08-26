"use client";

import { useRouter } from "next/navigation";
import { AccessRestricted } from "@/components/auth/access-restricted";
import { useSession } from "@/lib/session";

export default function ForbiddenPage() {
  const { user } = useSession();
  const router = useRouter();
  return (
    <AccessRestricted
      onRetry={() =>
        router.replace(
          user?.role === "ADMIN"
            ? "/admin"
            : user?.role === "MENTOR"
              ? "/mentor"
              : "/app",
        )
      }
    />
  );
}