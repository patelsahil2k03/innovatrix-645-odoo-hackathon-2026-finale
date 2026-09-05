"use client";

import { Sidebar } from "@/components/shell/sidebar";

/**
 * Chrome around every authenticated page: sidebar + page content.
 *
 * No separate topbar — live status, the trial balance badge, theme toggle
 * and user/sign-out all live in the sidebar's own footer (see Sidebar).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <main className="page">{children}</main>
      </div>
    </div>
  );
}
