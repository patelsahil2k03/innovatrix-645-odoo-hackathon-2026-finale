"use client";

/**
 * The customer portal's own shell — a separate layout, one route (My
 * Documents), no navigation into the internal app (05_FRONTEND.md §2). A
 * portal user must never see an internal nav item, even disabled, so this
 * deliberately does not reuse <AppShell>/<Sidebar>.
 */

import { LogOutIcon, LogoMark } from "@/components/icons";
import { useAuth } from "@/lib/auth-context";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="portal-shell">
      <header className="portal-topbar">
        <div className="sidebar-brand" style={{ padding: 0 }}>
          <LogoMark size={18} className="brand-mark" />
          <span>Urban Furniture — My Account</span>
        </div>
        {user ? (
          <div className="row">
            <span className="pagination-info">{user.full_name}</span>
            <button type="button" className="btn btn-sm" onClick={logout}>
              <LogOutIcon size={14} />
              <span>Sign out</span>
            </button>
          </div>
        ) : null}
      </header>
      <main className="portal-main">{children}</main>
    </div>
  );
}
