"use client";

import { useRouter } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { AccountForm } from "@/components/forms/account-form";
import { ClosePanel } from "@/components/ui/close-panel";
import { api, type AccountCreate } from "@/lib/api";

export default function NewAccountPage() {
  const router = useRouter();

  async function handleCreate(values: AccountCreate) {
    const created = await api.accounts.create(values);
    router.push(`/account/chart-of-accounts/${created.id}`);
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
