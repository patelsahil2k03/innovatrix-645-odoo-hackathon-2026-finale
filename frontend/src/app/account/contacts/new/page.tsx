"use client";

import { usePathname, useRouter } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ContactForm } from "@/components/forms/contact-form";
import { ClosePanel } from "@/components/ui/close-panel";
import { api, type ContactCreate } from "@/lib/api";
import { parentRouteOf } from "@/lib/use-close-panel";
import { useToast } from "@/lib/toast-context";

export default function NewContactPage() {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();

  async function handleCreate(values: ContactCreate) {
    await api.contacts.create(values);
    toast.success("Contact created");
    router.push(parentRouteOf(pathname ?? "/"));
  }

  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "Account" }, { label: "Contact", href: "/account/contacts" }, { label: "New" }]} />
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
