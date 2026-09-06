"use client";

/**
 * Product category picker with inline create (03_DATA_MODEL.md §2: "Category
 * can be created and saved on the fly"). A select plus a small "+ New" modal
 * rather than a full autocomplete — same capability, far less surface area.
 */

import { useState } from "react";

import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PlusIcon } from "@/components/icons";
import type { ProductCategory } from "@/lib/api";

interface CategoryComboboxProps {
  categories: ProductCategory[];
  value: string;
  onChange: (categoryId: string) => void;
  onCreate: (name: string) => Promise<ProductCategory>;
  error?: string;
}

export function CategoryCombobox({ categories, value, onChange, onCreate, error }: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setCreateError(null);
    try {
      const created = await onCreate(name.trim());
      onChange(created.id);
      setOpen(false);
      setName("");
    } catch {
      setCreateError("Couldn't create that category. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Field label="Category" error={error} required>
        {(props) => (
          <div className="combo-row">
            <select
              {...props}
              className="select"
              value={value}
              onChange={(event) => onChange(event.target.value)}
            >
              <option value="">Select a category…</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            <button type="button" className="btn btn-sm" onClick={() => setOpen(true)}>
              <PlusIcon size={14} />
              New
            </button>
          </div>
        )}
      </Field>

      <Modal
        open={open}
        title="New product category"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" form="new-category-form" className="btn btn-primary" disabled={saving}>
              {saving ? "Creating…" : "Create"}
            </button>
          </>
        }
      >
        <form id="new-category-form" onSubmit={handleCreate}>
          {createError ? <div className="alert alert-danger" role="alert">{createError}</div> : null}
          <Field label="Category name" required>
            {(props) => (
              <input
                {...props}
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
              />
            )}
          </Field>
        </form>
      </Modal>
    </>
  );
}
