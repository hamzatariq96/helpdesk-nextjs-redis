import { redis } from "./redis";
import type { TicketEvent } from "./types";

export const TICKET_CHANNEL = "tickets:events";

/**
 * Published through Redis so every app instance hears about every change,
 * not just the instance that handled the write.
 */
export async function publishTicketEvent(event: TicketEvent): Promise<void> {
  await redis.publish(TICKET_CHANNEL, JSON.stringify(event));
}
