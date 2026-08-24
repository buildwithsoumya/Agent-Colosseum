import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError, type ZodTypeAny } from "zod";
import { badRequest } from "../lib/errors.js";

type Part = "body" | "query" | "params";

/**
 * Validates and replaces the request part with the parsed value.
 * Clients cannot smuggle unvalidated data past this point.
 */
export function validate(schema: ZodTypeAny, part: Part = "body"): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req[part]);
      Object.defineProperty(req, part, { value: parsed, writable: true, configurable: true });
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(badRequest("Validation failed", err.flatten().fieldErrors));
      } else {
        next(err);
      }
    }
  };
};
