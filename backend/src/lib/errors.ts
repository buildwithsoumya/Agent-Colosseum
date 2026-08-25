import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = "APP_ERROR",
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (msg: string, details?: unknown) => new AppError(400, msg, "BAD_REQUEST", details);
export const unauthorized = (msg = "Authentication required") => new AppError(401, msg, "UNAUTHORIZED");
export const forbidden = (msg = "You do not have permission to do that") => new AppError(403, msg, "FORBIDDEN");
export const notFound = (msg = "Not found") => new AppError(404, msg, "NOT_FOUND");
export const conflict = (msg: string) => new AppError(409, msg, "CONFLICT");
export const gone = (msg = "This resource is no longer available") => new AppError(410, msg, "GONE");
export const unprocessable = (msg: string) => new AppError(422, msg, "UNPROCESSABLE");
