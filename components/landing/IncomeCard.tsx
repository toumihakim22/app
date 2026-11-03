import { formatDA, incomeCurve } from "@/data/landing";

// Courbe du cumul : même construction que cumulativeChart() de web/src/ui.js (§4.2, §5) :
// cumul monotone, cubique à tangentes horizontales (aucun dépassement), trait 2 px, point final en HTML.
const cum = incomeCurve.reduce<number[]>((a, v) => [...a, (a.at(-1) ?? 0) + v], []);
const max = Math.max(...cum), W = 300, H = 100, step = W / (cum.length - 1);
const pts = cum.map((v, i) => [i * step, H - (v / max) * (H - 6)] as const);
const d = pts.reduce(
  (s, [x, y], i) => (i ? `${s} C ${(pts[i - 1][0] + x) / 2} ${pts[i - 1][1].toFixed(2)}, ${(pts[i - 1][0] + x) / 2} ${y.toFixed(2)}, ${x} ${y.toFixed(2)}` : `M ${x} ${y.toFixed(2)}`),
  "",
);
const [ex, ey] = pts[pts.length - 1];

// Solde héros (équivalent de bigMoney(n, "money")) : chiffres proportionnels en Geist, « DA » plus petit et atténué.
export default function IncomeCard({ amount = formatDA(48200), trend = "+12,4 %" }: { amount?: string; trend?: string }) {
  const unit = /[\s ]DA$/.exec(amount);
  const value = unit ? amount.slice(0, unit.index) : amount;

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <div className="p-5">
        <p className="text-small font-medium text-fg-muted">Solde disponible</p>
        <p className="mt-1 whitespace-nowrap text-[1.875rem] font-semibold leading-9 tracking-[-0.03em] text-fg sm:text-money">
          {value}
          {unit && <span className="text-base font-medium tracking-normal text-fg-subtle sm:text-lg">{"\u00a0"}DA</span>}
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
          <span className="inline-flex h-6 items-center gap-1 rounded-badge border border-success-border bg-success-bg px-2 text-xs font-medium tabular-nums text-success-fg">
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />
            </svg>
            {trend}
          </span>
          par rapport au mois dernier
        </p>
      </div>
      <div className="relative h-24 pr-4" role="img" aria-label="Courbe des gains cumulés, en hausse sur les dernières semaines">
        <div className="relative size-full">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
            <path d={`${d} L ${W} ${H} L 0 ${H} Z`} className="fill-chart-income/12" />
            <path d={d} className="fill-none stroke-chart-income" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <span
            className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-income ring-2 ring-surface"
            style={{ left: `${(ex / W) * 100}%`, top: `${(ey / H) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
