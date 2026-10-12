import type { Metadata } from "next";
import "./globals.css";
import { themeInitScript } from "./theme-init";

export const metadata: Metadata = {
  title: "ClipBoost — Transformez vos clips en revenus",
  description:
    "ClipBoost connecte les créateurs de clips et les marques en Algérie. Choisissez une campagne, publiez vos clips et suivez vos gains.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
