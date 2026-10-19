import type { Metadata } from "next";
import "./globals.css";
import { themeInitScript } from "./theme-init";

export const metadata: Metadata = {
  title: "ClipBoost — Transformez vos clips en revenus",
  description:
    "ClipBoost connecte les créateurs de clips et les marques. Choisissez une campagne, publiez vos clips et suivez vos gains.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#f5f6f8" />
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
