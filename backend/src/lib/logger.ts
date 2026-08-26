import { createRequire } from "node:module";
import { env } from "../config/env.js";
import { onWorkers } from "../types/cf.js";

/**
 * Logger.
 * - Node (dev/docker): pino, pretty-printed in development.
 * - Cloudflare Workers: minimal structured console sink — pino transports
 *   cannot run inside Workers, and static pino import would bloat the bundle.
 */
interface Logger {
  info(objOrMsg: unknown, msg?: string): void;
  warn(objOrMsg: unknown, msg?: string): void;
  error(objOrMsg: unknown, msg?: string): void;
  debug(objOrMsg: unknown, msg?: string): void;
}

function consoleLogger(): Logger {
  const emit =
    (level: "info" | "warn" | "error" | "debug") =>
    (objOrMsg: unknown, msg?: string): void => {
      const line = msg
        ? `${msg} ${typeof objOrMsg === "object" ? JSON.stringify(objOrMsg) : String(objOrMsg)}`
        : String(objOrMsg);
      (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(
        `[${level}] ${line}`,
      );
    };
  return { info: emit("info"), warn: emit("warn"), error: emit("error"), debug: emit("debug") };
}

function pinoLogger(): Logger {
  const req = createRequire(import.meta.url);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pino = req("pino") as (opts: Record<string, unknown>) => Logger;
  return pino({
    level: env.LOG_LEVEL,
    base: undefined,
    transport: env.NODE_ENV === "development" && !process.env.VITEST ? { target: "pino-pretty" } : undefined,
  });
}

export const logger: Logger = onWorkers() ? consoleLogger() : pinoLogger();
