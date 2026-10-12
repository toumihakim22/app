"use client";

import { useMemo, useState } from "react";
import { campaigns, categories } from "@/data/landing";
import CampaignCard from "./CampaignCard";
import SectionTitle from "./SectionTitle";

export default function Campaigns() {
  const [active, setActive] = useState<(typeof categories)[number]>("Toutes");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return campaigns.filter(
      (c) =>
        (active === "Toutes" || c.category === active) &&
        (!q || c.title.toLowerCase().includes(q) || c.brand.toLowerCase().includes(q)),
    );
  }, [active, query]);

  return (
    <section id="campagnes" className="scroll-mt-20 bg-gray-50 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionTitle
          eyebrow="Campagnes à la une"
          title="Des marques algériennes cherchent vos clips"
          text="Un aperçu des campagnes disponibles. Le tarif indiqué correspond à la rémunération pour 1 000 vues."
        />

        <div className="mt-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block w-full lg:max-w-sm">
            <span className="sr-only">Rechercher une campagne</span>
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une campagne ou une marque"
              className="w-full rounded-2xl border border-gray-200 bg-white py-3.5 pl-12 pr-4 text-sm text-ink outline-none transition placeholder:text-gray-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            />
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtrer par catégorie">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={active === cat}
                onClick={() => setActive(cat)}
                className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  active === cat ? "bg-ink text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:text-ink"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {visible.length > 0 ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((c) => (
              <CampaignCard key={c.id} c={c} />
            ))}
          </div>
        ) : (
          <p className="mt-10 rounded-3xl bg-white p-10 text-center text-gray-500 ring-1 ring-gray-100">
            Aucune campagne ne correspond à votre recherche.
          </p>
        )}
      </div>
    </section>
  );
}
