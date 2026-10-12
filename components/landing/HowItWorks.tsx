import type { ReactNode } from "react";
import { steps } from "@/data/landing";
import SectionTitle from "./SectionTitle";

// Icônes au trait (mêmes tracés que icons de web/src/ui.js), choisies par index : le champ `icon` de steps n'est plus lu.
const stepIcons: ReactNode[] = [
  <>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="0.5" />
  </>,
  <>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" />
  </>,
  <>
    <path d="M3 7a2 2 0 0 1 2-2h13v4" />
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M16 13.5h2" />
  </>,
];

export default function HowItWorks() {
  return (
    <section id="comment-ca-marche" className="scroll-mt-20 bg-surface py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionTitle
          eyebrow="Comment ça marche"
          title="Trois étapes pour être payé à la vue"
          text={"Pas de négociation, pas d'attente : les règles de chaque campagne sont visibles dès le départ."}
        />
        <ol className="mt-12 grid gap-4 md:grid-cols-3 lg:mt-14">
          {steps.map((s, i) => (
            <li
              key={s.title}
              className="relative rounded-card border border-line bg-surface p-6 shadow-card md:after:absolute md:after:-right-4 md:after:top-10 md:after:h-px md:after:w-4 md:after:bg-line-strong md:last:after:hidden"
            >
              <div className="flex items-center justify-between">
                <span className="grid size-8 place-items-center rounded-full bg-brand-soft text-small font-semibold tabular-nums text-brand-fg">
                  <span className="sr-only">Étape </span>
                  {i + 1}
                </span>
                <svg viewBox="0 0 24 24" className="size-5 text-fg-subtle" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {stepIcons[i % stepIcons.length]}
                </svg>
              </div>
              <h3 className="mt-5 text-section text-fg [word-spacing:0.05em]">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-7 text-fg-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
