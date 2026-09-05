"use client";

import { usePathname, useRouter } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { AccountForm } from "@/components/forms/account-form";
import { ClosePanel } from "@/components/ui/close-panel";
import { api, type AccountCreate } from "@/lib/api";
import { parentRouteOf } from "@/lib/use-close-panel";
import { useToast } from "@/lib/toast-context";

export default function NewAccountPage() {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();

  async function handleCreate(values: AccountCreate) {
    await api.accounts.create(values);
    toast.success("Account created");
    router.push(parentRouteOf(pathname ?? "/"));
  }

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1>New account</h1>
          <p>Add a Chart of Accounts entry.</p>
        </div>
        <ClosePanel />
      </div>
      <AccountForm onSubmit={handleCreate} submitLabel="Create account" />
    </AppShell>
  );
}
