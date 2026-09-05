/**
 * Light/dark theme, persisted per browser.
 *
 * The boot script runs BEFORE first paint (see app/layout.tsx). Without it the page
 * renders in the default theme for one frame and then snaps — a visible flash that
 * makes an otherwise polished UI feel cheap.
 */

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "theme";

/** Injected as a blocking inline script so it executes before the first paint. */
export const THEME_BOOT_SCRIPT = `
(function () {
  try {
    var t = localStorage.getItem('${STORAGE_KEY}');
    if (t === 'dark' || t === 'light') {
      document.documentElement.setAttribute('data-theme', t);
    }
  } catch (e) {}
})();
`;

export function getTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "dark" || stored === "light" ? stored : "system";
  } catch {
    // Private mode / blocked storage: fall back rather than crash the app.
    return "system";
  }
}

export function setTheme(theme: Theme): void {
  try {
    if (theme === "system") {
      localStorage.removeItem(STORAGE_KEY);
      document.documentElement.removeAttribute("data-theme");
    } else {
      localStorage.setItem(STORAGE_KEY, theme);
      document.documentElement.setAttribute("data-theme", theme);
    }
  } catch {
    /* storage unavailable — the in-memory attribute change still applies */
  }
  notify();
}

export function resolvedTheme(): "light" | "dark" {
  const theme = getTheme();
  if (theme !== "system") return theme;
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/* ── External-store plumbing for useSyncExternalStore ──────────────────────
   Theme lives in localStorage, which is an external store. Reading it with
   useState + useEffect means a synchronous setState inside an effect, which
   causes a cascading re-render (and React 19's lint rules reject it).
   useSyncExternalStore is the API built for exactly this.                    */

const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeToTheme(listener: () => void): () => void {
  listeners.add(listener);
  // Also react to changes made in another tab.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export const getThemeSnapshot = (): Theme => getTheme();

/** During SSR there is no localStorage; "system" matches what the boot script
 *  leaves on the document when nothing is stored. */
export const getThemeServerSnapshot = (): Theme => "system";
