"use client";

import { use } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SkeletonCard } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProductForm, productToFormValues } from "@/components/forms/product-form";
import { ClosePanel } from "@/components/ui/close-panel";
import { api, type ProductCreate } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useConfirmAction } from "@/lib/use-confirm-action";
import { useFetch } from "@/lib/use-fetch";
import { useToast } from "@/lib/toast-context";
import { can } from "@/lib/roles";

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const toast = useToast();
  const product = useFetch(() => api.products.get(id), [id]);

  const canManage = can.manageMasterData(user?.role.name);

  async function handleUpdate(values: ProductCreate) {
    await api.products.update(id, values);
    product.reload();
  }

  const archiveAction = useConfirmAction(async () => {
    await api.products.archive(id);
    product.reload();
    toast.success("Product archived");
  });

  return (
    <AppShell>
      <Breadcrumbs
        items={[
          { label: "Account" },
          { label: "Product", href: "/account/products" },
          { label: product.data?.name ?? "…" },
        ]}
      />
      <AsyncState
        loading={product.loading}
        error={product.error}
        data={product.data}
        onRetry={product.reload}
        skeleton={<SkeletonCard lines={4} />}
      >
        {(data) => (
          <>
            <div className="page-head">
              <div>
                <h1>{data.name}</h1>
                <p>{data.is_archived ? <StatusBadge status="archived" /> : <StatusBadge status="active" />}</p>
              </div>
              {canManage && !data.is_archived ? (
                <button type="button" className="btn btn-danger" onClick={archiveAction.request}>
                  Archive
                </button>
              ) : null}
              <ClosePanel />
            </div>

            {!canManage ? (
              <div className="alert alert-info">
                Only an Admin can modify or archive master data — you can view this record.
              </div>
            ) : null}

            <ProductForm
              initial={productToFormValues(data)}
              onSubmit={handleUpdate}
              submitLabel="Save changes"
              readOnly={!canManage || data.is_archived}
            />

            <ConfirmDialog
              open={archiveAction.open}
              onCancel={archiveAction.cancel}
              onConfirm={archiveAction.confirm}
              pending={archiveAction.pending}
              error={archiveAction.error}
              tone="danger"
              title="Archive this product?"
              confirmLabel="Archive product"
              pendingLabel="Archiving…"
              description={
                <p>
                  {data.name} will no longer appear in active lists or pickers on new documents.
                  Existing sales and purchase lines for this product are untouched, but there is
                  no way to unarchive it from the app yet.
                </p>
              }
            />
          </>
        )}
      </AsyncState>
    </AppShell>
  );
}
