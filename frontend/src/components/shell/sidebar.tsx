"use client";

/**
 * Primary navigation.
 *
 * "Intuitive navigation with proper menu placement and spacing" is an explicit
 * judging criterion, so: persistent sidebar, clear active state (accent bar +
 * background + aria-current), generous spacing, role-filtered items.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

import { HomeIcon, ShieldIcon } from "@/components/icons";
import { useAuth } from "@/lib/auth-context";
import { canSeeNavItem } from "@/lib/roles";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}

/** ★ Replace with your problem statement's screens. */
const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: HomeIcon },
  // { href: "/orders", label: "Orders", icon: ListIcon },   // import ListIcon when you enable this
  { href: "/audit-log", label: "Audit log", icon: ShieldIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const visible = NAV.filter((item) => canSeeNavItem(item.href, user?.role.name));

  return (
    <nav className="sidebar" aria-label="Main navigation">
      <div className="sidebar-brand">
        <span className="dot" />
        {/* ★ Your product name */}
        <span>Project</span>
      </div>

      <div className="sidebar-nav">
        {visible.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="nav-item"
              aria-current={active ? "page" : undefined}
            >
              <Icon size={16} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
