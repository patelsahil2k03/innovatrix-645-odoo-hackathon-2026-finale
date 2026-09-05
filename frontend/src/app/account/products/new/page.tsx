"use client";

import { useRouter } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { ProductForm } from "@/components/forms/product-form";
import { ClosePanel } from "@/components/ui/close-panel";
import { api, type ProductCreate } from "@/lib/api";

export default function NewProductPage() {
  const router = useRouter();

  async function handleCreate(values: ProductCreate) {
    const created = await api.products.create(values);
    router.push(`/account/products/${created.id}`);
  }

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1>New product</h1>
          <p>Create a good or service.</p>
        </div>
        <ClosePanel />
      </div>
      <ProductForm onSubmit={handleCreate} submitLabel="Create product" />
    </AppShell>
  );
}
