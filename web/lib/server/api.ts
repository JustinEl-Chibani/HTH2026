import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, code?: string) => new ApiError(400, msg, code);
export const unauthorized = (msg = "Please sign in") => new ApiError(401, msg, "UNAUTHORIZED");
export const forbidden = (msg = "Not allowed") => new ApiError(403, msg, "FORBIDDEN");
export const notFound = (msg = "Not found") => new ApiError(404, msg, "NOT_FOUND");
export const tooMany = (msg: string) => new ApiError(429, msg, "RATE_LIMITED");

/** JSON.stringify that turns BigInt into strings (money is always BigInt base units). */
export function toJson(data: unknown): string {
  return JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
}

export function json(data: unknown, init?: ResponseInit): NextResponse {
  return new NextResponse(toJson(data), {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wraps a route handler: maps ApiError/ZodError to clean JSON errors, logs the rest. */
export function route<C>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) {
        return json({ error: e.message, code: e.code }, { status: e.status });
      }
      if (e instanceof ZodError) {
        const first = e.issues[0];
        const where = first?.path.length ? `${first.path.join(".")}: ` : "";
        return json(
          { error: `${where}${first?.message ?? "Invalid input"}`, code: "INVALID_INPUT" },
          { status: 400 },
        );
      }
      console.error(`[api] ${req.method} ${new URL(req.url).pathname}`, e);
      return json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw badRequest("Expected a JSON body");
  }
}
