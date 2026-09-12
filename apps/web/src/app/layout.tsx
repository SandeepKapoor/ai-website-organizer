import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Website Organizer",
  description: "A visual memory layer for the websites you've saved.",
};

// Applied synchronously before paint (not in a client-component useEffect)
// so there's no flash of the wrong theme on load, and so the setting
// actually persists across reloads — previously nothing re-applied the
// `dark` class on mount, only the Settings page's button clicks did.
// Default is "dark" when nothing's been chosen yet, per the product default.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var theme = localStorage.getItem("theme") || "dark";
    var isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (isDark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
