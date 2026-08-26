import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { env, isProd } from "../config/env.js";
import { onWorkers } from "../types/cf.js";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * Runtime-aware Prisma client.
 *
 * - Node (local dev / docker): classic engine-based client.
 * - Cloudflare Workers: driver adapter over node-postgres against the Supabase
 *   transaction pooler — engine binaries cannot run inside Workers.
 *   Requires `nodejs_compat` so pg's sockets route through cloudflare:sockets.
 */
function createClient(): PrismaClient {
  if (!onWorkers()) {
    return new PrismaClient({
      log: isProd ? ["error", "warn"] : ["error", "warn", "info"],
    });
  }
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    // Supabase pooler presents a certificate chain Node/Workers cannot verify
    // against the default CA bundle — require TLS without CA verification.
    ssl: { rejectUnauthorized: false },
  } as never);
  return new PrismaClient({ adapter } as never);
}

export const prisma: PrismaClient = globalThis.__prisma ?? createClient();

if (!isProd) globalThis.__prisma = prisma;
void env;

