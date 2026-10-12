"use client";

import { useEffect, useRef, useState } from "react";
import { formatDA, type Campaign } from "@/data/landing";

// Carte campagne : même structure que la recette §4.4 de l'app (couverture .cover[data-cat], puce de tarif, dl).
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
const BTN = `inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors duration-150 ease-standard ${FOCUS}`;
const CARD = "rounded-card border border-line bg-surface shadow-card";
const CARD_HOVER = "transition-[border-color,box-shadow] duration-150 ease-standard hover:border-line-strong hover:shadow-card-hover";
// Bouton copier : volontairement différent de la chaîne remplacée par la version hors ligne (§0.3).
const COPY = `${BTN} h-8 w-full rounded-lg px-3 text-small border border-line-strong bg-surface shadow-control hover:bg-subtle [&_svg]:size-4`;

export default function CampaignCard({ c }: { c: Campaign }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const url = `https://clipboost.dz/c/${c.id}`;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Presse-papiers indisponible (contexte non sécurisé) : on affiche quand même le retour visuel.
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <article data-category={c.category} data-search={`${c.title} ${c.brand}`.toLowerCase()} className={`flex flex-col ${CARD} ${CARD_HOVER} p-2`}>
      <div className="cover relative aspect-[16/9] overflow-hidden rounded-tile" data-cat={c.category}>
        <span className="absolute inset-0 grid place-items-center text-5xl drop-shadow-[0_6px_14px_rgb(0_0_0/0.22)]" aria-hidden="true">
          {c.emoji}
        </span>
        <span className="absolute left-2.5 top-2.5 inline-flex items-baseline gap-1 rounded-badge bg-night/80 px-2 py-1 text-small font-semibold tabular-nums text-on-brand backdrop-blur-sm">
          {formatDA(c.ratePer1k)}
          <span className="text-[11px] font-medium text-on-brand/80">/ 1k&nbsp;vues</span>
        </span>
        {c.topCampaign && (
          <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-badge bg-on-brand/90 px-1.5 py-0.5 text-[11px] font-semibold text-night">
            <svg viewBox="0 0 24 24" className="size-3" fill="currentColor" aria-hidden="true">
              <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
            </svg>
            Top campagne
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 px-2 pb-1 pt-3">
        <div>
          <p className="text-xs text-fg-subtle">
            {c.brand} · {c.category}
          </p>
          <h3 className="mt-0.5 font-sans text-[15px] font-semibold leading-snug text-fg">{c.title}</h3>
        </div>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-small">
          <dt className="text-fg-subtle">Générés</dt>
          <dd className="whitespace-nowrap text-right font-medium tabular-nums text-income">{formatDA(c.generated, { signed: true })}</dd>
          <dt className="text-fg-subtle">Créée le</dt>
          <dd className="text-right font-medium tabular-nums text-fg">{c.createdAt}</dd>
        </dl>
        <div className="mt-auto pt-1">
          <button type="button" onClick={copyLink} data-copy={url} className={`${COPY} ${copied ? "text-success-fg" : "text-fg"}`}>
            {copied ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12l5 5L20 7" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="9" y="9" width="11" height="11" rx="2" />
                <path d="M5 15V6a2 2 0 0 1 2-2h9" />
              </svg>
            )}
            {copied ? "Lien copié" : "Copier le lien"}
          </button>
          {/* Annonce pour les lecteurs d'écran (hors du bouton : la version hors ligne lit son textContent). */}
          <span className="sr-only" role="status" aria-live="polite">
            {copied ? `Lien de la campagne ${c.title} copié` : ""}
          </span>
        </div>
      </div>
    </article>
  );
}
