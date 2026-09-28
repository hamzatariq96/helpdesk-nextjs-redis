"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/clientApi";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="text-sm text-slate-600 hover:text-slate-900"
      onClick={async () => {
        await api("/api/auth/logout", { method: "POST" });
        router.replace("/login");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
