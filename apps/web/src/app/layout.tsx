import type { ReactNode } from "react";
import { DEFAULT_LOCALE } from "@kantorcore/config";

export const metadata = {
  title: "KantorCore",
  description: "The foundation Indonesian businesses build their systems on.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // Bahasa Indonesia is the default locale (Rule 24).
  return (
    <html lang={DEFAULT_LOCALE}>
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
