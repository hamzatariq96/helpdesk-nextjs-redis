"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { TicketEvent } from "@/lib/types";

const VERB: Record<TicketEvent["type"], string> = {
  created: "opened",
  updated: "updated",
  commented: "commented on",
};

/**
 * Listens to the SSE stream and refreshes server-rendered data when any ticket
 * changes, so every open tab stays current without polling.
 */
export function LiveUpdates({ currentUserName }: { currentUserName: string }) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const source = new EventSource("/api/events");
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (message) => {
      const event = JSON.parse(message.data) as TicketEvent;
      // Several events in a burst trigger a single refresh.
      clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 250);
      if (event.actor !== currentUserName) {
        setToast(`${event.actor} ${VERB[event.type]} #${event.ticketId}: ${event.title}`);
      }
    };
    return () => {
      source.close();
      clearTimeout(refreshTimer.current);
    };
  }, [router, currentUserName]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <>
      <span className="flex items-center gap-1.5 text-xs text-slate-500" title="Live updates">
        <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-slate-300"}`} />
        {connected ? "Live" : "Offline"}
      </span>
      {toast && (
        <div role="status" className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
