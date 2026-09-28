import { z } from "zod";
import { PRIORITIES, STATUSES } from "./types";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const createTicketSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().trim().max(5000).default(""),
  priority: z.enum(PRIORITIES).default("medium"),
  assigneeId: z.number().int().positive().nullable().default(null),
});

export const updateTicketSchema = z
  .object({
    status: z.enum(STATUSES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    assigneeId: z.number().int().positive().nullable().optional(),
  })
  .refine((patch) => Object.values(patch).some((value) => value !== undefined), {
    message: "Nothing to update",
  });

export const commentSchema = z.object({
  body: z.string().trim().min(1, "Comment can't be empty").max(5000),
});

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

export const ticketFiltersSchema = z.object({
  status: z.preprocess(emptyToUndefined, z.enum(STATUSES).optional()),
  assignee: z.preprocess(
    emptyToUndefined,
    z.union([z.literal("me"), z.literal("unassigned"), z.coerce.number().int().positive()]).optional(),
  ),
  q: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  page: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).default(1)),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type TicketFilters = z.infer<typeof ticketFiltersSchema>;

/** Next.js search params can be string arrays; take the first value and ignore bad input. */
export function parseTicketFilters(params: Record<string, string | string[] | undefined>): TicketFilters {
  const flat = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const result = ticketFiltersSchema.safeParse(flat);
  return result.success ? result.data : { page: 1 };
}
