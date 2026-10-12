import { testimonials } from "@/data/landing";
import SectionTitle from "./SectionTitle";

// Fonds d'avatars (palette AA, texte blanc ≥ 5:1) : classes complètes, Tailwind ne détecte pas une classe concaténée.
const avatarColors = ["bg-avatar-1", "bg-avatar-2", "bg-avatar-3"];

// Témoignages (§7.9) : sans étoiles, mention « Témoignages illustratifs » (honnêteté, §9).
export default function Testimonials() {
  return (
    <section className="bg-surface py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionTitle eyebrow="Témoignages" title="Ils utilisent déjà ClipBoost" />
        <div className="mt-12 grid gap-4 md:grid-cols-3 lg:mt-14">
          {testimonials.map((t, i) => (
            <figure key={t.name} className="flex flex-col rounded-card border border-line bg-surface p-6 shadow-card">
              <span className="block h-5 font-display text-4xl leading-none text-brand-fg" aria-hidden="true">
                &ldquo;
              </span>
              <blockquote className="mt-3 flex-1 text-[15px] leading-7 text-fg">{t.quote}</blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-full text-xs font-semibold text-on-brand ${avatarColors[i % avatarColors.length]}`}
                  aria-hidden="true"
                >
                  {t.initials}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-fg">{t.name}</p>
                  <p className="text-small text-fg-subtle">
                    {t.role} · {t.city}
                  </p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-fg-subtle">Témoignages illustratifs</p>
      </div>
    </section>
  );
}
