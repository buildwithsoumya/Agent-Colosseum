import { PrismaClient } from "@prisma/client";
import { env, isProd } from "../config/env.js";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log: isProd ? ["error", "warn"] : ["error", "warn", "info"],
  });

if (!isProd) globalThis.__prisma = prisma;
