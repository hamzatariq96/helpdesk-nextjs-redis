import { NewTicketForm } from "@/components/NewTicketForm";
import { requireUser } from "@/lib/auth";
import { listAssignableUsers } from "@/repositories/users";

export default async function NewTicketPage() {
  await requireUser();
  const people = await listAssignableUsers();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">New ticket</h1>
      <NewTicketForm people={people} />
    </div>
  );
}
