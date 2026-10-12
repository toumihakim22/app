import { stats } from "@/data/landing";

export default function StatsStrip() {
  return (
    <section className="border-y border-gray-100 bg-white">
      <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-y-8 px-4 py-10 sm:px-6 lg:grid-cols-4 lg:px-8">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col-reverse text-center">
            <dt className="mt-1 text-sm text-gray-500">{s.label}</dt>
            <dd className="text-3xl font-extrabold tracking-tight text-ink">{s.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
