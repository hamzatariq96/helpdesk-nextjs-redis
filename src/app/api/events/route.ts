import { requireApiUser } from "@/lib/auth";
import { TICKET_CHANNEL } from "@/lib/events";
import { route } from "@/lib/http";
import { createSubscriber } from "@/lib/redis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEARTBEAT_MS = 25_000;

/**
 * Server-Sent Events stream of ticket changes. Each open tab gets its own Redis
 * subscriber, which is closed as soon as the browser disconnects.
 */
export const GET = route(async (request) => {
  await requireApiUser();

  const subscriber = createSubscriber();
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const cleanup = () => {
    if (heartbeat) clearInterval(heartbeat);
    subscriber.disconnect();
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };

      subscriber.on("message", (_channel, message) => send(`data: ${message}\n\n`));
      await subscriber.subscribe(TICKET_CHANNEL);
      send(": connected\n\n");
      // Comments keep proxies from closing an idle connection.
      heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);

      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel: cleanup,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
