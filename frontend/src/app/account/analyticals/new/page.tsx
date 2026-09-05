"use client";

import { useRouter } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { AnalyticAccountForm } from "@/components/forms/analytic-account-form";
import { api, type AnalyticAccountCreate } from "@/lib/api";

export default function NewAnalyticAccountPage() {
  const router = useRouter();

  async function handleCreate(values: AnalyticAccountCreate) {
    const created = await api.analyticAccounts.create(values);
    router.push(`/account/analyticals/${created.id}`);
  }

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1>New analytic account</h1>
          <p>A reporting tag for budgets — projects or departments.</p>
        </div>
      </div>
      <AnalyticAccountForm onSubmit={handleCreate} submitLabel="Create analytic account" />
    </AppShell>
  );
}
