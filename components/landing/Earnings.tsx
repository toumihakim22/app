import { transactions } from "@/data/landing";
import IncomeCard from "./IncomeCard";
import TransactionRow from "./TransactionRow";
import SectionTitle from "./SectionTitle";

const points = [
  { title: "Suivi en temps réel", text: "Vues, gains et statut de chaque clip mis à jour au fil de la journée." },
  { title: "Gains par campagne", text: "Repérez en un coup d'œil les campagnes qui vous rapportent le plus." },
  { title: "Historique clair", text: "Chaque versement est daté et marqué « En cours » ou « Validé »." },
];

export default function Earnings() {
  return (
    <section id="gains" className="scroll-mt-20 py-20 lg:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div className="order-2 lg:order-1">
          <div className="mx-auto max-w-md rounded-[2rem] bg-gray-50 p-5 ring-1 ring-gray-100">
            <div className="mb-4 flex items-center justify-between rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-gray-100">
              <div className="flex items-center gap-3">
                <span className="flex" aria-hidden="true">
                  <span className="h-6 w-6 rounded-full bg-brand-600" />
                  <span className="-ml-2.5 h-6 w-6 rounded-full bg-amber-400/90" />
                </span>
                <span className="text-sm font-medium text-gray-700">Portefeuille •••• 5678</span>
              </div>
              <span className="text-gray-400" aria-hidden="true">⋮</span>
            </div>
            <IncomeCard />
            <div className="mt-3 space-y-3">
              {transactions.map((t) => (
                <TransactionRow key={t.date + t.time} t={t} />
              ))}
            </div>
            <a
              href="#inscription"
              className="mt-4 block rounded-2xl bg-brand-600 py-4 text-center text-base font-semibold text-white transition hover:bg-brand-700"
            >
              Inviter un créateur <span aria-hidden="true">🙋</span>
            </a>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <SectionTitle
            eyebrow="Vos gains"
            title="Chaque vue compte, et vous le voyez"
            text="Votre portefeuille ClipBoost rassemble vos revenus, leur évolution et l'historique de vos versements."
          />
          <ul className="mt-10 space-y-6">
            {points.map((p) => (
              <li key={p.title} className="flex gap-4">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-income text-white" aria-hidden="true">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                </span>
                <div>
                  <h3 className="font-bold text-ink">{p.title}</h3>
                  <p className="mt-1 text-gray-600">{p.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
