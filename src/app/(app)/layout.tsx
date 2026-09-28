import Link from "next/link";
import { LiveUpdates } from "@/components/LiveUpdates";
import { LogoutButton } from "@/components/LogoutButton";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="font-semibold text-indigo-700">Helpdesk</Link>
          <nav className="flex flex-wrap gap-4 text-sm text-slate-600">
            <Link href="/" className="hover:text-slate-900">Dashboard</Link>
            <Link href="/tickets" className="hover:text-slate-900">Tickets</Link>
            <Link href="/tickets/new" className="hover:text-slate-900">New ticket</Link>
            {user.role === "admin" && <Link href="/reports" className="hover:text-slate-900">Reports</Link>}
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <LiveUpdates currentUserName={user.name} />
            <span className="text-sm text-slate-700">
              {user.name} <span className="text-slate-400">({user.role})</span>
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
