"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api } from "@/lib/clientApi";
import { canTransition } from "@/lib/sla";
import { PRIORITIES, STATUSES, type Ticket, type UserRef } from "@/lib/types";

export function TicketControls({ ticket, people }: { ticket: Ticket; people: UserRef[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function update(patch: Record<string, unknown>) {
    setPending(true);
    setError(null);
    try {
      await api(`/api/tickets/${ticket.id}`, { method: "PATCH", body: patch });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div>
        <label className="label" htmlFor="status">Status</label>
        <select id="status" className="input capitalize" value={ticket.status} disabled={pending} onChange={(e) => update({ status: e.target.value })}>
          {STATUSES.filter((s) => canTransition(ticket.status, s)).map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="priority">Priority</label>
        <select id="priority" className="input capitalize" value={ticket.priority} disabled={pending} onChange={(e) => update({ priority: e.target.value })}>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="assignee">Assignee</label>
        <select
          id="assignee"
          className="input"
          value={ticket.assignee?.id ?? ""}
          disabled={pending}
          onChange={(e) => update({ assigneeId: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">Unassigned</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function CommentForm({ ticketId }: { ticketId: number }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api(`/api/tickets/${ticketId}/comments`, { method: "POST", body: { body } });
      setBody("");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      {error && <p className="text-sm text-red-700">{error}</p>}
      <textarea className="input min-h-24" placeholder="Write a reply..." value={body} onChange={(e) => setBody(e.target.value)} required />
      <button className="btn" disabled={pending || !body.trim()}>{pending ? "Posting..." : "Add comment"}</button>
    </form>
  );
}
