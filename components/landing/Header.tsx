"use client";

import { useEffect, useState } from "react";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

// Chaînes équivalentes à btn() de web/src/ui.js (§7).
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
const BTN = `inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors duration-150 ease-standard ${FOCUS}`;
const LG = "h-12 rounded-control px-5 text-[15px] [&_svg]:size-5";
const MD = "h-10 rounded-control px-4 text-sm [&_svg]:size-4";
const SECONDARY = "border border-line-strong bg-surface text-fg shadow-control hover:border-line-control hover:bg-subtle";
const GHOST = "text-fg-muted hover:bg-muted hover:text-fg";

const links = [
  { href: "#comment-ca-marche", label: "Comment ça marche" },
  { href: "#marques", label: "Pour qui" },
  { href: "#faq", label: "FAQ" },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  // Échap referme le menu mobile.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Navigation principale">
          {links.map((l) => (
            <a key={l.href} href={l.href} className={`rounded-sm text-sm font-medium text-fg-muted transition-colors hover:text-fg ${FOCUS}`}>
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          <a href="/espace#/connexion" className={`${BTN} ${MD} ${GHOST}`}>
            Se connecter
          </a>
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          <ThemeToggle />
          {/* Un seul <path> : la version hors ligne réécrit son attribut d (menu / croix). */}
          <button
            type="button"
            className={`inline-grid size-10 place-items-center rounded-lg text-fg-muted transition-colors hover:bg-muted hover:text-fg ${FOCUS}`}
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"} />
            </svg>
          </button>
        </div>
      </div>

      <div id="menu-mobile" className={`${open ? "" : "hidden "}border-t border-line bg-surface px-4 pb-5 pt-2 lg:hidden`}>
        <nav className="flex flex-col" aria-label="Navigation mobile">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`flex h-11 items-center rounded-lg px-3 text-[15px] font-medium text-fg transition-colors hover:bg-subtle ${FOCUS}`}
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="mt-3 grid border-t border-line pt-4">
          <a href="/espace#/connexion" onClick={() => setOpen(false)} className={`${BTN} ${LG} ${SECONDARY}`}>
            Se connecter
          </a>
        </div>
      </div>
    </header>
  );
}
