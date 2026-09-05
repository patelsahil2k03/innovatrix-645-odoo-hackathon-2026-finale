"use client";

import { use, useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProductForm, productToFormValues } from "@/components/forms/product-form";
import { api, type ProductCreate } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useFetch } from "@/lib/use-fetch";
import { can } from "@/lib/roles";

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const product = useFetch(() => api.products.get(id), [id]);
  const [archiving, setArchiving] = useState(false);

  const canManage = can.manageMasterData(user?.role.name);

  async function handleUpdate(values: ProductCreate) {
    await api.products.update(id, values);
    product.reload();
  }

  async function handleArchive() {
    setArchiving(true);
    try {
      await api.products.archive(id);
      product.reload();
    } finally {
      setArchiving(false);
    }
  }

  return (
    <AppShell>
      <AsyncState loading={product.loading} error={product.error} data={product.data} onRetry={product.reload}>
        {(data) => (
          <>
            <div className="page-head">
              <div>
                <h1>{data.name}</h1>
                <p>{data.is_archived ? <StatusBadge status="archived" /> : <StatusBadge status="active" />}</p>
              </div>
              {canManage && !data.is_archived ? (
                <button type="button" className="btn btn-danger" onClick={handleArchive} disabled={archiving}>
                  {archiving ? "Archiving…" : "Archive"}
                </button>
              ) : null}
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
          </>
        )}
      </AsyncState>
    </AppShell>
  );
}
