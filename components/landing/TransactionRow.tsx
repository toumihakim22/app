import { formatDA, type Transaction } from "@/data/landing";

// Ligne d'historique d'argent (§4.6, §7.7) : pastille « entrée » verte, libellé, date en chiffres tabulaires,
// montant signé en text-income (argent qui entre chez celui qui regarde) et statut avec point (jamais la couleur seule).
const STATUS: Record<Transaction["status"], { badge: string; dot: string }> = {
  "Validé": { badge: "border-success-border bg-success-bg text-success-fg", dot: "bg-success-solid" },
  "En cours": { badge: "border-info-border bg-info-bg text-info-fg", dot: "bg-info-solid" },
};

export default function TransactionRow({ t }: { t: Transaction }) {
  const tone = STATUS[t.status] ?? STATUS["En cours"];
  return (
    <div className="flex items-center gap-3 rounded-tile px-3 py-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-income-soft text-income" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 7L7 17M15 17H7V9" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg">Gains de campagne</p>
        <p className="truncate text-xs tabular-nums text-fg-subtle">
          {t.date} · {t.time}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="whitespace-nowrap text-sm font-medium tabular-nums text-income">{formatDA(t.amount, { signed: true })}</p>
        <span className={`mt-1 inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-badge border px-1.5 text-[11px] font-medium ${tone.badge}`}>
          <span className={`size-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
          {t.status}
        </span>
      </div>
    </div>
  );
}
