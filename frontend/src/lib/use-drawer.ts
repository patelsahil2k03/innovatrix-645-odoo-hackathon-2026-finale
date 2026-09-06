"use client";

import { useCallback, useState } from "react";

interface DrawerState {
  open: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
}

/**
 * Open/close state for a `Drawer` (`components/ui/drawer.tsx`) — one hook so
 * every side-panel trigger looks the same:
 *
 *   const filters = useDrawer();
 *   <button onClick={filters.openDrawer}>Filters</button>
 *   <Drawer open={filters.open} onClose={filters.closeDrawer} title="Filters" width={30}>…</Drawer>
 */
export function useDrawer(): DrawerState {
  const [open, setOpen] = useState(false);

  const openDrawer = useCallback(() => setOpen(true), []);
  const closeDrawer = useCallback(() => setOpen(false), []);
  const toggleDrawer = useCallback(() => setOpen((current) => !current), []);

  return { open, openDrawer, closeDrawer, toggleDrawer };
}
