import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { readJson, route } from "@/lib/http";
import { createTicketSchema, parseTicketFilters } from "@/lib/validation";
import { createTicket, listTickets } from "@/repositories/tickets";

export const GET = route(async (request) => {
  const user = await requireApiUser();
  const params = Object.fromEntries(new URL(request.url).searchParams);
  return NextResponse.json(await listTickets(parseTicketFilters(params), user.id));
});

export const POST = route(async (request) => {
  const user = await requireApiUser();
  const input = createTicketSchema.parse(await readJson(request));
  return NextResponse.json(await createTicket(input, user), { status: 201 });
});
