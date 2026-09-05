"use client";

import { usePathname, useRouter } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { JournalForm } from "@/components/forms/journal-form";
import { ClosePanel } from "@/components/ui/close-panel";
import { api, type JournalCreate } from "@/lib/api";
import { parentRouteOf } from "@/lib/use-close-panel";
import { useToast } from "@/lib/toast-context";

export default function NewJournalPage() {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();

  async function handleCreate(values: JournalCreate) {
    await api.journals.create(values);
    toast.success("Journal created");
    router.push(parentRouteOf(pathname ?? "/"));
  }

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1>New journal</h1>
          <p>Add a posting journal.</p>
        </div>
        <ClosePanel />
      </div>
      <JournalForm onSubmit={handleCreate} submitLabel="Create journal" />
    </AppShell>
  );
}
