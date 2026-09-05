"use client";

import { useRouter } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { ContactForm } from "@/components/forms/contact-form";
import { ClosePanel } from "@/components/ui/close-panel";
import { api, type ContactCreate } from "@/lib/api";

export default function NewContactPage() {
  const router = useRouter();

  async function handleCreate(values: ContactCreate) {
    const created = await api.contacts.create(values);
    router.push(`/account/contacts/${created.id}`);
  }

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1>New contact</h1>
          <p>Create a customer or vendor.</p>
        </div>
        <ClosePanel />
      </div>
      <ContactForm onSubmit={handleCreate} submitLabel="Create contact" />
    </AppShell>
  );
}
