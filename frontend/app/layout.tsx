import type { Metadata } from "next";
import { Geist_Mono, Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/lib/session";
import { RealtimeProvider } from "@/lib/realtime";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

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
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} ${geistMono.variable} font-sans`}
      >
        <SessionProvider>
          <RealtimeProvider>{children}</RealtimeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
