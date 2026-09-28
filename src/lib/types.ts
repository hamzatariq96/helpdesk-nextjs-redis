export const STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const ROLES = ["admin", "agent"] as const;

export type Status = (typeof STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Role = (typeof ROLES)[number];

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export interface UserRef {
  id: number;
  name: string;
}

export interface Ticket {
  id: number;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  createdBy: UserRef;
  assignee: UserRef | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface TicketComment {
  id: number;
  body: string;
  author: UserRef;
  createdAt: string;
}

export interface TicketEvent {
  type: "created" | "updated" | "commented";
  ticketId: number;
  title: string;
  actor: string;
  at: string;
}
