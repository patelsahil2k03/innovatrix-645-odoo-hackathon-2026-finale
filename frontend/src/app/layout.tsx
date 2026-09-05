import type { Metadata } from "next";
import Script from "next/script";

import { AuthProvider } from "@/lib/auth-context";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  // ★ Set these for your problem statement — a real title and favicon are part of
  //   looking finished, and cost nothing.
  title: "Project",
  description: "Built by Team Innovatrix",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* Applies the saved theme before first paint, so there is no flash of the
            wrong theme on load. */}
        <Script id="theme-boot" strategy="beforeInteractive">
          {THEME_BOOT_SCRIPT}
        </Script>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
