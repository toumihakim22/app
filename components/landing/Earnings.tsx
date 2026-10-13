import { campaigns, formatDA, transactions } from "@/data/landing";
import TransactionRow from "./TransactionRow";
import SectionTitle from "./SectionTitle";

// Maquette du portefeuille clipper (§7.6) : moyen de retrait, gains par campagne (recette barList, une seule teinte
// chart-income), historique. Marquée « Exemple » : aucun chiffre n'est présenté comme réel.
const CARD = "rounded-card border border-line bg-surface shadow-card";

const points = [
  { title: "Suivi en temps réel.", text: "Vues, gains et statut de chaque clip, mis à jour au fil de la journée." },
  { title: "Gains par campagne.", text: "Repérez en un coup d'œil les campagnes qui vous rapportent le plus." },
  { title: "Historique clair.", text: "Chaque versement est daté et marqué « En cours » ou « Validé »." },
];

// Les 3 premières campagnes, triées par montant généré (barres horizontales triées, §5.1).
const top = campaigns.slice(0, 3).sort((a, b) => b.generated - a.generated);
const maxGenerated = Math.max(1, ...top.map((c) => c.generated));

function Check() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

export default function Earnings() {
  return (
    <section id="gains" className="scroll-mt-20 bg-surface py-20 lg:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        {/* Texte d'abord dans le DOM (h2 avant la maquette) ; la maquette passe à gauche à partir de lg. */}
        <div>
          <div className="[&>div]:mx-0 [&>div]:text-left">
            <SectionTitle
              eyebrow="Vos gains"
              title="Chaque vue compte, et vous le voyez"
              text="Votre portefeuille ClipBoost rassemble vos revenus, leur évolution et l'historique de vos versements."
            />
          </div>
          <ul className="mt-8 grid gap-4">
            {points.map((p) => (
              <li key={p.title} className="flex gap-3">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-income-soft text-income" aria-hidden="true">
                  <Check />
                </span>
                <p className="text-[15px] leading-7 text-fg-muted">
                  <span className="font-medium text-fg">{p.title}</span> {p.text}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <figure className="mx-auto w-full max-w-xl lg:order-first" aria-label="Exemple de portefeuille clipper">
          <div className="rounded-panel border border-line bg-canvas p-3 shadow-modal sm:p-4">
            <div className="mb-3 flex items-center gap-1.5 px-1">
              <span className="size-2.5 rounded-full bg-line-strong" aria-hidden="true" />
              <span className="size-2.5 rounded-full bg-line-strong" aria-hidden="true" />
              <span className="size-2.5 rounded-full bg-line-strong" aria-hidden="true" />
              <span className="ml-2 truncate text-micro text-fg-subtle">clipboost.dz/espace/portefeuille</span>
              <span className="ml-auto inline-flex h-6 shrink-0 items-center rounded-badge border border-idle-border bg-idle-bg px-2 text-xs font-medium text-idle-fg">
                Exemple
              </span>
            </div>

            <div className="grid gap-3">
              {/* 1. Moyen de retrait */}
              <div className={`flex items-center gap-3 p-4 ${CARD}`}>
                <span className="grid size-10 shrink-0 place-items-center rounded-tile bg-subtle text-fg-muted" aria-hidden="true">
                  <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">BaridiMob</p>
                  <p className="truncate font-mono text-small text-fg-subtle">
                    <span aria-hidden="true">••••</span>
                    <span className="sr-only">Compte se terminant par</span>&nbsp;5678
                  </p>
                </div>
                <span className="inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-badge border border-success-border bg-success-bg px-2 text-xs font-medium text-success-fg">
                  <Check />
                  Vérifié
                </span>
              </div>

              {/* 2. Gains par campagne : barres horizontales triées, une seule teinte (recette barList, §4.2) */}
              <div className={`p-5 ${CARD}`}>
                <p className="font-display text-section text-fg">Gains par campagne</p>
                <ul className="mt-4 grid gap-4" aria-label="Gains par campagne">
                  {top.map((c) => (
                    <li key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
                      <span className="flex min-w-0 items-center gap-2 text-sm text-fg">
                        <span className="cover grid size-5 shrink-0 place-items-center rounded-[4px] text-[11px]" data-cat={c.category} aria-hidden="true">
                          {c.emoji}
                        </span>
                        <span className="truncate">{c.title}</span>
                      </span>
                      <span className="whitespace-nowrap text-sm font-medium tabular-nums text-fg">{formatDA(c.generated)}</span>
                      <span className="col-span-2 block h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <span className="block h-full rounded-full bg-chart-income" style={{ width: `max(2px, ${((c.generated / maxGenerated) * 100).toFixed(1)}%)` }} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 3. Historique */}
              <div className={`p-2 ${CARD}`}>
                {transactions.map((t) => (
                  <TransactionRow key={t.date + t.time} t={t} />
                ))}
              </div>
            </div>
          </div>
        </figure>
      </div>
    </section>
  );
}
