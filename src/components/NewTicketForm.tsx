"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api } from "@/lib/clientApi";
import { PRIORITIES, type Priority, type Ticket, type UserRef } from "@/lib/types";

export function NewTicketForm({ people }: { people: UserRef[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const ticket = await api<Ticket>("/api/tickets", {
        method: "POST",
        body: { title, description, priority, assigneeId: assigneeId ? Number(assigneeId) : null },
      });
      router.push(`/tickets/${ticket.id}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card max-w-2xl space-y-4">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div>
        <label className="label" htmlFor="title">Title</label>
        <input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={200} />
      </div>
      <div>
        <label className="label" htmlFor="description">Description</label>
        <textarea id="description" className="input min-h-32" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="priority">Priority</label>
          <select id="priority" className="input capitalize" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="assignee">Assignee</label>
          <select id="assignee" className="input" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">Unassigned</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>
      <button type="submit" className="btn" disabled={pending}>{pending ? "Creating..." : "Create ticket"}</button>
    </form>
  );
}
