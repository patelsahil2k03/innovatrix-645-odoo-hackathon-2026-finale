"use client";

import { usePathname, useRouter } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ProductForm } from "@/components/forms/product-form";
import { ClosePanel } from "@/components/ui/close-panel";
import { api, type ProductCreate } from "@/lib/api";
import { parentRouteOf } from "@/lib/use-close-panel";
import { useToast } from "@/lib/toast-context";

export default function NewProductPage() {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();

  async function handleCreate(values: ProductCreate) {
    await api.products.create(values);
    toast.success("Product created");
    router.push(parentRouteOf(pathname ?? "/"));
  }

  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "Account" }, { label: "Product", href: "/account/products" }, { label: "New" }]} />
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
