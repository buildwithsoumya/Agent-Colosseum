import { env, isProd } from "../config/env.js";
import { logger } from "./logger.js";

/**
 * Error-monitoring abstraction.
 * Sentry (or any sink) plugs in here — enable by setting SENTRY_DSN and
 * initialising the SDK in server bootstrap. Kept sink-agnostic so local dev
 * has zero external dependencies.
 */
export function captureException(err: unknown, context?: Record<string, unknown>): void {
  // if (env.SENTRY_DSN) Sentry.captureException(err, { extra: context });
  if (!isProd) logger.debug({ err, context }, "captureException");
}
