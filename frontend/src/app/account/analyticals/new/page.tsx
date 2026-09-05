"use client";

import { usePathname, useRouter } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { AnalyticAccountForm } from "@/components/forms/analytic-account-form";
import { ClosePanel } from "@/components/ui/close-panel";
import { api, type AnalyticAccountCreate } from "@/lib/api";
import { parentRouteOf } from "@/lib/use-close-panel";
import { useToast } from "@/lib/toast-context";

export default function NewAnalyticAccountPage() {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();

  async function handleCreate(values: AnalyticAccountCreate) {
    await api.analyticAccounts.create(values);
    toast.success("Analytic account created");
    router.push(parentRouteOf(pathname ?? "/"));
  }

  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "Account" }, { label: "Analyticals", href: "/account/analyticals" }, { label: "New" }]} />
      <div className="page-head">
        <div>
          <h1>New analytic account</h1>
          <p>A reporting tag for budgets — projects or departments.</p>
        </div>
        <ClosePanel />
      </div>
      <AnalyticAccountForm onSubmit={handleCreate} submitLabel="Create analytic account" />
    </AppShell>
  );
}
