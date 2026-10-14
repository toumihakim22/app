import { transactions } from "@/data/landing";
import IncomeCard from "./IncomeCard";
import TransactionRow from "./TransactionRow";

// Chaînes équivalentes à btn() de web/src/ui.js (§7).
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
const BTN = `inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors duration-150 ease-standard ${FOCUS}`;
const LG = "h-12 rounded-control px-5 text-[15px] [&_svg]:size-5";
const PRIMARY = "bg-brand text-on-brand shadow-control hover:bg-brand-hover active:bg-brand-active";
const SECONDARY = "border border-line-strong bg-surface text-fg shadow-control hover:border-line-control hover:bg-subtle";

// Fonds d'avatars : classes complètes (Tailwind ne détecte pas une classe construite par concaténation).
const avatars = [
  ["YB", "bg-avatar-1"],
  ["AK", "bg-avatar-2"],
  ["MR", "bg-avatar-3"],
  ["SL", "bg-avatar-4"],
] as const;

export default function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:px-8 lg:pb-28 lg:pt-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-small font-medium text-fg-muted shadow-control">
            {/* Drapeau en SVG (jamais d'emoji) : identique à flagDz() de web/src/ui.js. */}
            <svg viewBox="0 0 30 20" className="h-3 w-[18px] shrink-0 rounded-xs ring-1 ring-fg/10" role="img" aria-label="Algérie">
              <rect width="15" height="20" fill="#006233" />
              <rect x="15" width="15" height="20" fill="#ffffff" />
              <mask id="dz-crescent-hero">
                <rect width="30" height="20" fill="#fff" />
                <circle cx="16.25" cy="10" r="4" fill="#000" />
              </mask>
              <circle cx="15" cy="10" r="5" fill="#d21034" mask="url(#dz-crescent-hero)" />
              <polygon fill="#d21034" points="15.50,10.00 16.91,9.50 16.95,8.00 17.86,9.19 19.30,8.77 18.45,10.00 19.30,11.23 17.86,10.81 16.95,12.00 16.91,10.50" />
            </svg>
            La plateforme de clipping pensée pour l&apos;Algérie
          </p>
          <h1 className="mt-6 text-h1 text-fg [word-spacing:0.05em] sm:text-display">
            {/* Plus Jakarta Sans n'a pas de crénage « s. » : le point est rapproché pour ne pas sembler détaché. */}
            Transformez vos clips en <span className="text-brand-fg">revenus<span className="-ml-[0.08em]">.</span></span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-fg-muted">
            ClipBoost met en relation les marques et les créateurs de vidéos courtes. Choisissez une campagne, publiez vos clips et
            suivez chaque dinar gagné depuis un seul tableau de bord.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="/espace#/inscription" className={`${BTN} ${LG} ${PRIMARY}`}>
              Devenir clipper
            </a>
            <a href="#marques" className={`${BTN} ${LG} ${SECONDARY}`}>
              Lancer une campagne
            </a>
          </div>
          <div className="mt-8 flex items-center gap-3">
            <div className="flex -space-x-1" aria-hidden="true">
              {avatars.map(([initials, bg]) => (
                <span key={initials} className={`grid size-8 place-items-center rounded-full text-[11px] font-semibold text-on-brand ring-2 ring-surface ${bg}`}>
                  {initials}
                </span>
              ))}
            </div>
            <p className="text-small text-fg-muted">
              {/* Le nombre d'inscrits figure déjà dans la bande de chiffres juste dessous (§9.5 : un chiffre clé, une fois). */}
              <strong className="font-semibold text-fg">Inscription gratuite</strong> · retrait dès <span className="whitespace-nowrap tabular-nums">2&nbsp;000&nbsp;DA</span>
            </p>
          </div>
        </div>

        {/* Visuel produit : maquette de l'espace clipper, marquée « Exemple » (aucun chiffre présenté comme réel).
            Sous lg, une seule colonne : largeur limitée à celle du chapô pour ne pas étirer la maquette. */}
        <div className="relative mx-auto w-full max-w-xl lg:mx-0 lg:max-w-none">
          <div
            className="pointer-events-none absolute -inset-x-10 -inset-y-12 -z-10 bg-[radial-gradient(55%_55%_at_60%_35%,color-mix(in_oklab,var(--color-brand)_14%,transparent),transparent_70%)]"
            aria-hidden="true"
          />
          <div className="rounded-panel border border-line bg-canvas p-3 shadow-modal sm:p-4">
            <div className="mb-3 flex items-center gap-1.5 px-1">
              <span className="size-2.5 rounded-full bg-line-strong" aria-hidden="true" />
              <span className="size-2.5 rounded-full bg-line-strong" aria-hidden="true" />
              <span className="size-2.5 rounded-full bg-line-strong" aria-hidden="true" />
              <span className="ml-2 truncate text-micro text-fg-subtle">clipboost.dz/espace</span>
              <span className="ml-auto inline-flex h-6 shrink-0 items-center rounded-badge border border-idle-border bg-idle-bg px-2 text-xs font-medium text-idle-fg">
                Exemple
              </span>
            </div>
            <div className="grid gap-3">
              <IncomeCard />
              <div className="rounded-card border border-line bg-surface p-2 shadow-card">
                {transactions.slice(0, 2).map((t) => (
                  <TransactionRow key={t.date + t.time} t={t} />
                ))}
              </div>
            </div>
          </div>
          <div className="absolute -bottom-8 left-6 hidden items-center gap-3 rounded-control border border-line bg-surface-raised px-3.5 py-2.5 shadow-popover md:flex">
            <span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand-fg" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </span>
            <div>
              <p className="text-xs text-fg-subtle">Vues cette semaine</p>
              <p className="text-sm font-semibold tabular-nums text-fg">+248&nbsp;300</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
