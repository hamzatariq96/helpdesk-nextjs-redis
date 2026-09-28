import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { parseId, readJson, route } from "@/lib/http";
import { updateTicketSchema } from "@/lib/validation";
import { getTicket, updateTicket } from "@/repositories/tickets";

type Context = { params: { id: string } };

export const GET = route<Context>(async (_request, { params }) => {
  await requireApiUser();
  return NextResponse.json(await getTicket(parseId(params.id)));
});

export const PATCH = route<Context>(async (request, { params }) => {
  const user = await requireApiUser();
  const patch = updateTicketSchema.parse(await readJson(request));
  return NextResponse.json(await updateTicket(parseId(params.id), patch, user));
});
