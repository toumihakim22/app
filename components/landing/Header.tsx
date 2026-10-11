"use client";

import { useState } from "react";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

const links = [
  { href: "#comment-ca-marche", label: "Comment ça marche", icon: "🧭" },
  { href: "#campagnes", label: "Campagnes", icon: "🎬" },
  { href: "#gains", label: "Gains", icon: "💰" },
  { href: "#faq", label: "FAQ", icon: "💬" },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Navigation principale">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="flex items-center gap-1.5 text-[15px] font-medium text-gray-600 transition hover:text-ink"
            >
              <span aria-hidden="true" className="text-sm">{l.icon}</span>
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <ThemeToggle />
          <a href="#inscription" data-route="connexion" className="rounded-xl px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-gray-100">
            Se connecter
          </a>
          <a
            href="#inscription"
            data-route="inscription"
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/30 transition hover:bg-brand-700"
          >
            Commencer gratuitement
          </a>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
        <ThemeToggle />
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-xl border border-gray-200 text-ink"
          aria-expanded={open}
          aria-controls="menu-mobile"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
        </div>
      </div>

      <div id="menu-mobile" className={`${open ? "" : "hidden "}border-t border-gray-100 bg-white px-4 pb-5 pt-2 lg:hidden`}>
          <nav className="flex flex-col" aria-label="Navigation mobile">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-base font-medium text-gray-700 hover:bg-gray-50"
              >
                <span aria-hidden="true">{l.icon}</span>
                {l.label}
              </a>
            ))}
          </nav>
          <div className="mt-3 grid gap-2">
            <a href="#inscription" data-route="connexion" onClick={() => setOpen(false)} className="rounded-xl border border-gray-200 px-4 py-3 text-center text-sm font-semibold text-ink">
              Se connecter
            </a>
            <a href="#inscription" data-route="inscription" onClick={() => setOpen(false)} className="rounded-xl bg-brand-600 px-4 py-3 text-center text-sm font-semibold text-white">
              Commencer gratuitement
            </a>
          </div>
      </div>
    </header>
  );
}
