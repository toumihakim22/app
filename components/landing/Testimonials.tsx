import { testimonials } from "@/data/landing";
import SectionTitle from "./SectionTitle";

const avatarColors = ["bg-rose-400", "bg-amber-400", "bg-brand-600"];

export default function Testimonials() {
  return (
    <section className="py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionTitle center eyebrow="Témoignages" title="Ils utilisent déjà ClipBoost" />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <figure key={t.name} className="flex flex-col rounded-3xl bg-white p-7 shadow-sm ring-1 ring-gray-100">
              <div className="text-amber-400" aria-label="5 étoiles sur 5">★★★★★</div>
              <blockquote className="mt-4 flex-1 leading-relaxed text-gray-700">« {t.quote} »</blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <span className={`grid h-11 w-11 place-items-center rounded-full text-sm font-bold text-white ${avatarColors[i % avatarColors.length]}`} aria-hidden="true">
                  {t.initials}
                </span>
                <div>
                  <p className="font-semibold text-ink">{t.name}</p>
                  <p className="text-sm text-gray-500">
                    {t.role} · {t.city}
                  </p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-gray-400">Témoignages fictifs, à titre d&apos;illustration.</p>
      </div>
    </section>
  );
}
