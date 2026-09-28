import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { parseId, readJson, route } from "@/lib/http";
import { commentSchema } from "@/lib/validation";
import { addComment } from "@/repositories/tickets";

type Context = { params: { id: string } };

export const POST = route<Context>(async (request, { params }) => {
  const user = await requireApiUser();
  const { body } = commentSchema.parse(await readJson(request));
  return NextResponse.json(await addComment(parseId(params.id), body, user), { status: 201 });
});
