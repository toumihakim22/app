"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { campaigns, categories } from "@/data/landing";
import CampaignCard from "./CampaignCard";
import SectionTitle from "./SectionTitle";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
// inputCls de web/src/ui.js (§4.2), complété par h-11 pl-9 (§7.5).
const INPUT =
  "block h-10 w-full rounded-control border border-line-strong bg-surface px-3 text-base text-fg shadow-control transition-[border-color,box-shadow] duration-150 placeholder:text-fg-subtle hover:border-line-control focus:border-focus focus:outline-hidden focus:ring-3 focus:ring-focus/20 disabled:cursor-not-allowed disabled:bg-subtle disabled:text-fg-disabled read-only:bg-subtle aria-[invalid=true]:border-danger-solid aria-[invalid=true]:focus:ring-danger-solid/20 sm:text-sm";
// Puce de catégorie : l'apparence vient d'aria-selected (que la version hors ligne met aussi à jour).
const TAB = `inline-flex h-9 shrink-0 items-center rounded-full px-4 text-small font-medium text-fg-muted ring-1 ring-inset ring-line-strong transition-colors not-aria-selected:hover:text-fg aria-selected:bg-brand aria-selected:text-on-brand aria-selected:ring-brand ${FOCUS}`;
const RESET = `inline-flex h-8 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-line-strong bg-surface px-3 text-small font-medium text-fg shadow-control transition-colors duration-150 ease-standard hover:border-line-control hover:bg-subtle ${FOCUS}`;

type Category = (typeof categories)[number];

export default function Campaigns() {
  const [active, setActive] = useState<Category>("Toutes");
  const [query, setQuery] = useState("");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return campaigns.filter(
      (c) =>
        (active === "Toutes" || c.category === active) &&
        (!q || c.title.toLowerCase().includes(q) || c.brand.toLowerCase().includes(q)),
    );
  }, [active, query]);

  // Flèches, Début et Fin déplacent la sélection entre les catégories (motif ARIA des onglets).
  function onTabKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const last = categories.length - 1;
    const next = { ArrowRight: i === last ? 0 : i + 1, ArrowLeft: i === 0 ? last : i - 1, Home: 0, End: last }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    setActive(categories[next]);
    tabs.current[next]?.focus();
  }

  return (
    <section id="campagnes" className="scroll-mt-20 bg-canvas py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionTitle
          eyebrow="Campagnes à la une"
          title="Des marques algériennes cherchent vos clips"
          text={"Un aperçu des campagnes disponibles. Le tarif indiqué correspond à la rémunération pour 1 000 vues."}
        />

        <div className="mt-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block w-full lg:max-w-sm">
            <span className="sr-only">Rechercher une campagne</span>
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher par campagne ou marque"
              autoComplete="off"
              className={`${INPUT} h-11 pl-9`}
            />
          </label>
          {/* Défilable sous sm ; 4 px de marge intérieure (compensée) pour que l'anneau de focus ne soit pas rogné. */}
          <div className="-mx-4 -my-1 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:-mx-1 sm:px-1" role="tablist" aria-label="Filtrer par catégorie">
            {categories.map((cat, i) => (
              <button
                key={cat}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                type="button"
                role="tab"
                aria-selected={active === cat}
                onClick={() => setActive(cat)}
                onKeyDown={(e) => onTabKey(e, i)}
                className={TAB}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {visible.length > 0 ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((c) => (
              <CampaignCard key={c.id} c={c} />
            ))}
          </div>
        ) : (
          <div className="mt-10 flex flex-col items-center rounded-card border border-dashed border-line-strong bg-surface px-6 py-12 text-center" role="status">
            <span className="grid size-10 place-items-center rounded-full bg-muted text-fg-subtle" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
            </span>
            <p className="mt-3 text-sm font-semibold text-fg">Aucune campagne ne correspond à votre recherche.</p>
            <p className="mt-1 max-w-sm text-small text-fg-muted">Essayez un autre mot-clé ou une autre catégorie.</p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setActive("Toutes");
              }}
              className={`mt-4 ${RESET}`}
            >
              Effacer les filtres
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
