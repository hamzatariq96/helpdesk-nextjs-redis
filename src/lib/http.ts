import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./errors";

type Handler<C> = (request: Request, context: C) => Promise<Response>;

/** Turns thrown errors into consistent JSON responses so route handlers stay short. */
export function route<C>(handler: Handler<C>): Handler<C> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
      }
      if (error instanceof HttpError) {
        return NextResponse.json({ error: error.message }, { status: error.status, headers: error.headers });
      }
      console.error(error);
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }
  };
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Request body must be JSON");
  }
}

export function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid id");
  return id;
}
