"use client";

import { useState } from "react";
import { formatDA, type Campaign } from "@/data/landing";

export default function CampaignCard({ c }: { c: Campaign }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const url = `https://clipboost.dz/c/${c.id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Presse-papiers indisponible (contexte non sécurisé) : on affiche quand même le retour visuel.
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <article data-category={c.category} data-search={`${c.title} ${c.brand}`.toLowerCase()} className="flex flex-col rounded-3xl bg-white p-2.5 shadow-sm ring-1 ring-gray-100 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className={`relative aspect-[4/3.6] overflow-hidden rounded-2xl bg-gradient-to-br ${c.gradient}`}>
        <span className="absolute left-3 top-3 rounded-lg bg-ink/90 px-2 py-1 text-sm font-bold text-white">
          {c.ratePer1k} DA<span className="font-medium text-white/70"> /1K</span>
        </span>
        <span className="absolute inset-0 grid place-items-center text-6xl drop-shadow-lg" aria-hidden="true">
          {c.emoji}
        </span>
        <span className="absolute bottom-3 left-3 grid h-9 w-9 place-items-center rounded-full bg-white/25 text-white backdrop-blur" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
          </svg>
        </span>
        {c.topCampaign && (
          <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-sm font-semibold text-ink">
            <span aria-hidden="true">⭐</span> Top campagne
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col px-3 pb-2 pt-4">
        <p className="text-xs text-gray-400">Créée le {c.createdAt}</p>
        <h3 className="mt-1.5 text-lg font-semibold text-ink">{c.title}</h3>
        <ul className="mt-3 space-y-2 text-sm text-gray-700">
          <li className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" aria-hidden="true" />
            {c.brand} · {c.category}
          </li>
          <li className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" aria-hidden="true" />
            {formatDA(c.generated)} générés
          </li>
        </ul>
        <button
          type="button"
          onClick={copyLink}
          data-copy={`https://clipboost.dz/c/${c.id}`}
          className={`mt-4 rounded-xl py-2 text-sm font-semibold transition ${
            copied ? "bg-emerald-50 text-emerald-700" : "bg-brand-50 text-brand-700 hover:bg-brand-100"
          }`}
        >
          {copied ? "Lien copié ✓" : "Copier le lien"}
        </button>
      </div>
    </article>
  );
}
