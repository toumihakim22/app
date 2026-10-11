import { formatDA, type Transaction } from "@/data/landing";

export default function TransactionRow({ t }: { t: Transaction }) {
  const pending = t.status === "En cours";
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-sm ring-1 ring-gray-100">
      <div className="min-w-0">
        <p className="whitespace-nowrap text-sm font-medium text-gray-800">{t.date}</p>
        <p className="text-xs text-gray-500">{t.time}</p>
      </div>
      <p className="whitespace-nowrap text-sm font-medium text-gray-800">+ {formatDA(t.amount)}</p>
      <span
        className={`whitespace-nowrap rounded-md px-2 py-1 text-xs font-bold ${
          pending ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
        }`}
      >
        {t.status}
      </span>
    </div>
  );
}
