import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/lib/session";
import { RealtimeProvider } from "@/lib/realtime";

export const metadata: Metadata = {
  title: {
    default: "Agent Colosseum",
    template: "%s · Agent Colosseum",
  },
  description:
    "A gamified hackathon where teams build AI agents under a live credit economy, sabotage, casino risk and a zero-touch adversarial Gauntlet.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <RealtimeProvider>{children}</RealtimeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
