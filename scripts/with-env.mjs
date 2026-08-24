#!/usr/bin/env node
/**
 * Cross-platform helper: loads the monorepo-root .env into process.env,
 * then execs the given command. Keeps every workspace script working from
 * any package directory without shell-specific syntax.
 *
 *   node ../../scripts/with-env.mjs prisma migrate deploy
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, ".env");

if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let value = (m[2] ?? "").trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error("usage: node with-env.mjs <command> [args…]");
  process.exit(1);
}

const result = spawnSync(cmd, args, { stdio: "inherit", env: process.env });
process.exit(result.status ?? 1);
