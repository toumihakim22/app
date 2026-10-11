import { campaigns, transactions } from "@/data/landing";
import IncomeCard from "./IncomeCard";
import TransactionRow from "./TransactionRow";
import CampaignCard from "./CampaignCard";

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-brand-100/60 blur-3xl" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-2 lg:px-8 lg:pb-28 lg:pt-20">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3.5 py-1.5 text-sm font-semibold text-brand-700 ring-1 ring-brand-100">
            <span aria-hidden="true">🇩🇿</span> La plateforme de clipping pensée pour l&apos;Algérie
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-6xl">
            Transformez vos clips en <span className="text-brand-600">revenus</span>.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-gray-600">
            ClipBoost met en relation les marques et les créateurs de vidéos courtes. Choisissez une campagne, publiez vos
            clips et suivez chaque dinar gagné depuis un seul tableau de bord.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a
              href="#inscription"
              className="rounded-2xl bg-ink px-7 py-4 text-center text-base font-semibold text-white shadow-lg shadow-ink/20 transition hover:bg-black"
            >
              + Devenir Clipper
            </a>
            <a
              href="#marques"
              className="rounded-2xl bg-brand-600 px-7 py-4 text-center text-base font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700"
            >
              Lancer une campagne <span aria-hidden="true">🚀</span>
            </a>
          </div>
          <div className="mt-10 flex items-center gap-4">
            <div className="flex -space-x-2" aria-hidden="true">
              {["bg-rose-400", "bg-amber-400", "bg-emerald-500", "bg-sky-500"].map((c, i) => (
                <span key={c} className={`grid h-9 w-9 place-items-center rounded-full border-2 border-white text-xs font-bold text-white ${c}`}>
                  {["YB", "AK", "MR", "SL"][i]}
                </span>
              ))}
            </div>
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-ink">12 400+ clippers</span> gagnent déjà avec leurs vidéos courtes
            </p>
          </div>
        </div>

        {/* Aperçu du tableau de bord */}
        <div className="relative">
          <div className="rounded-[2rem] bg-gray-50 p-4 ring-1 ring-gray-100 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-[1.2fr_1fr]">
              <div className="space-y-3">
                <IncomeCard />
                {transactions.slice(0, 2).map((t) => (
                  <TransactionRow key={t.date + t.time} t={t} />
                ))}
              </div>
              <div className="hidden sm:block">
                <CampaignCard c={campaigns[0]} />
              </div>
            </div>
          </div>
          <div className="absolute -bottom-6 right-6 hidden rounded-2xl bg-white px-4 py-3 shadow-xl ring-1 ring-gray-100 md:flex md:items-center md:gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-lg" aria-hidden="true">📈</span>
            <div>
              <p className="text-xs text-gray-500">Vues cette semaine</p>
              <p className="text-base font-bold text-ink">+ 248 300</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
