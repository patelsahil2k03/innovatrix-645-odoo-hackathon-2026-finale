"use client";

/**
 * List / Kanban toggle for the master screens that offer both
 * (05_FRONTEND.md §2.1). A toggle on the same data, not a second data source —
 * the page keeps one fetch and switches only how the rows render.
 */

import { GridIcon, ListViewIcon } from "@/components/icons";

export type ListView = "list" | "kanban";

export function ViewToggle({ value, onChange }: { value: ListView; onChange: (view: ListView) => void }) {
  return (
    <div className="view-toggle" role="group" aria-label="Change view">
      <button
        type="button"
        className="view-toggle-btn"
        aria-pressed={value === "list"}
        onClick={() => onChange("list")}
      >
        <ListViewIcon size={14} />
        List
      </button>
      <button
        type="button"
        className="view-toggle-btn"
        aria-pressed={value === "kanban"}
        onClick={() => onChange("kanban")}
      >
        <GridIcon size={14} />
        Kanban
      </button>
    </div>
  );
}
