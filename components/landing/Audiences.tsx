import type { ReactNode } from "react";
import SectionTitle from "./SectionTitle";

// Chaînes équivalentes à btn() de web/src/ui.js (§7).
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
const BTN = `inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors duration-150 ease-standard ${FOCUS}`;
const LG = "h-12 rounded-control px-5 text-[15px] [&_svg]:size-5";
const SECONDARY = "border border-line-strong bg-surface text-fg shadow-control hover:border-line-control hover:bg-subtle";
const ON_COLOR = "bg-on-brand text-brand-700 shadow-control hover:bg-brand-50";
// Sur le panneau violet, l'anneau violet (#7c3aed sur #7c3aed) est invisible : anneau blanc (on-brand).
const BTN_ON_COLOR = "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors duration-150 ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-brand";

const clipper = [
  "Inscription gratuite, sans minimum d'abonnés",
  "Campagnes dans le sport, la food, la tech, la mode et la musique",
  "Liens de suivi uniques pour chaque clip",
  "Tableau de bord de vos vues et de vos gains",
];

const brand = [
  "Budget maîtrisé : vous payez uniquement les vues obtenues",
  "Des centaines de créateurs dans les 48 wilayas",
  "Consignes et validation des clips avant diffusion",
  "Statistiques détaillées par clip et par créateur",
];

// Icônes au trait (mêmes tracés que icons de web/src/ui.js), trait 1,75.
function Icon({ className, children }: { className: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function Bullets({ items, bullet, text }: { items: string[]; bullet: string; text: string }) {
  return (
    <ul className="mt-7 grid gap-3.5">
      {items.map((item) => (
        <li key={item} className={`flex gap-3 text-[15px] leading-6 text-pretty ${text}`}>
          <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${bullet}`} aria-hidden="true">
            <Icon className="size-3.5">
              <path d="M5 12l5 5L20 7" />
            </Icon>
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function Audiences() {
  return (
    <section id="marques" className="scroll-mt-20 bg-canvas py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionTitle
          eyebrow="Pour qui"
          title="Clippers et marques, gagnant-gagnant"
          text="Les créateurs sont payés à la vue, les marques ne paient que les vues obtenues."
        />
        <div className="mt-12 grid gap-4 lg:mt-14 lg:grid-cols-2">
          {/* Clipper : carte surface */}
          <div className="flex flex-col rounded-card border border-line bg-surface p-8 shadow-card sm:p-10">
            <span className="grid size-11 place-items-center rounded-tile bg-brand-soft text-brand-fg">
              <Icon className="size-[22px]">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" />
              </Icon>
            </span>
            <h3 className="mt-6 text-heading text-fg">Vous êtes clipper</h3>
            <p className="mt-2 text-[15px] leading-7 text-fg-muted">Monétisez votre talent de montage avec des campagnes prêtes à l&apos;emploi.</p>
            <Bullets items={clipper} bullet="bg-brand-soft text-brand-fg" text="text-fg" />
            <div className="mt-auto pt-9">
              <a href="/espace#/inscription" className={`${BTN} ${LG} ${SECONDARY} w-full sm:w-auto`}>
                Devenir clipper
              </a>
            </div>
          </div>

          {/* Marque : grande surface brand-panel (violet en clair, violet profond en sombre), bouton blanc fixe */}
          <div className="flex flex-col rounded-card border border-transparent bg-brand-panel p-8 text-on-brand shadow-card sm:p-10">
            <span className="grid size-11 place-items-center rounded-tile bg-on-brand/15 text-on-brand">
              <Icon className="size-[22px]">
                <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M3 21h18M8 7h4M8 11h4M8 15h4" />
              </Icon>
            </span>
            <h3 className="mt-6 text-heading text-on-brand">Vous êtes une marque</h3>
            <p className="mt-2 text-[15px] leading-7 text-on-brand/90">Faites parler de vous partout en Algérie grâce à des créateurs authentiques.</p>
            <Bullets items={brand} bullet="bg-on-brand/15 text-on-brand" text="text-on-brand/90" />
            <div className="mt-auto pt-9">
              <a href="/espace#/inscription-agence" className={`${BTN_ON_COLOR} ${LG} ${ON_COLOR} w-full sm:w-auto`}>
                Lancer une campagne
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
