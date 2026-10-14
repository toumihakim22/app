import { faqs } from "@/data/landing";
import SectionTitle from "./SectionTitle";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

// FAQ (§7.10) : liste à filets (pas de cartes), <details> natif, chevron qui pivote à l'ouverture.
// Le padding vertical est sur <summary> : toute la hauteur de la ligne est cliquable (cible ≥ 40 px).
export default function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 bg-canvas py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionTitle eyebrow="FAQ" title="Questions fréquentes" />
        <div className="mx-auto mt-12 max-w-3xl divide-y divide-line border-y border-line">
          {faqs.map((f) => (
            <details key={f.q} className="group">
              <summary
                className={`flex cursor-pointer list-none items-center justify-between gap-4 rounded-sm py-5 text-base font-medium text-fg ${FOCUS} [&::-webkit-details-marker]:hidden`}
              >
                {f.q}
                <svg
                  viewBox="0 0 24 24"
                  className="size-5 shrink-0 text-fg-subtle transition-transform duration-200 group-open:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </summary>
              <p className="-mt-2 pb-5 pr-10 text-[15px] leading-7 text-fg-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
