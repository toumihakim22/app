import { incomeCurve } from "@/data/landing";

function buildPaths(values: number[], width: number, height: number) {
  const max = Math.max(...values);
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => [i * step, height - (v / max) * (height - 8)] as const);
  let line = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    line += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
  }
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;
  return { line, area };
}

export default function IncomeCard({ amount = "998 500 DA", trend = "+8,2 %" }: { amount?: string; trend?: string }) {
  const { line, area } = buildPaths(incomeCurve, 320, 120);

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-100">
      <div className="flex items-start justify-between gap-3 p-6 pb-2">
        <div>
          <p className="text-sm font-medium text-gray-700">Revenus</p>
          <p className="mt-2 whitespace-nowrap text-3xl font-extrabold tracking-tight text-ink">{amount}</p>
          <p className="mt-2 text-sm text-gray-600">
            <svg viewBox="0 0 24 24" className="mr-1 inline h-4 w-4 align-[-2px] text-ink" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />
            </svg>
            <span className="whitespace-nowrap font-semibold text-ink">{trend}</span> par rapport au mois dernier
          </p>
        </div>
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-income text-white shadow-md shadow-income/30">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M7 17L17 7M9 7h8v8" />
          </svg>
        </span>
      </div>
      <svg viewBox="0 0 320 120" preserveAspectRatio="none" className="h-32 w-full" role="img" aria-label="Courbe des revenus en hausse sur les dernières semaines">
        <defs>
          <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f766e" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#0f766e" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#incomeFill)" />
        <path d={line} fill="none" stroke="#0f766e" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
