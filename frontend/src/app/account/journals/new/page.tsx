"use client";

import { useRouter } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { JournalForm } from "@/components/forms/journal-form";
import { api, type JournalCreate } from "@/lib/api";

export default function NewJournalPage() {
  const router = useRouter();

  async function handleCreate(values: JournalCreate) {
    const created = await api.journals.create(values);
    router.push(`/account/journals/${created.id}`);
  }

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1>New journal</h1>
          <p>Add a posting journal.</p>
        </div>
      </div>
      <JournalForm onSubmit={handleCreate} submitLabel="Create journal" />
    </AppShell>
  );
}
