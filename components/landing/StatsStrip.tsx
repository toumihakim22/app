import { stats } from "@/data/landing";

// Chiffres clés (§7.5) : grands nombres seuls en Geist, chiffres proportionnels ; libellé sous la valeur
// (flex-col-reverse : dt avant dd dans le DOM pour les lecteurs d'écran).
export default function StatsStrip() {
  return (
    <section className="border-y border-line bg-surface" aria-label="ClipBoost en chiffres">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <dl className="grid grid-cols-2 gap-y-8 lg:grid-cols-4 lg:divide-x lg:divide-line">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col-reverse items-center gap-1 px-2 text-center">
              <dt className="text-small text-fg-muted">{s.label}</dt>
              <dd className="whitespace-nowrap font-sans text-[1.875rem] font-semibold leading-9 tracking-[-0.025em] text-fg">{s.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-8 text-center text-xs text-fg-subtle">Chiffres au 1er&nbsp;octobre 2026</p>
      </div>
    </section>
  );
}
