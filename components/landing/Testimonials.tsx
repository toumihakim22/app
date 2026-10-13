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
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:mt-14 lg:grid-cols-3">
          {testimonials.map((t, i) => (
            <figure key={t.name} className="flex flex-col rounded-card border border-line bg-surface p-6 shadow-card md:last:col-span-2 lg:last:col-span-1">
              {/* Guillemet dessiné (le glyphe typographique rendait une petite virgule isolée). */}
              <svg viewBox="0 0 24 24" className="size-7 text-brand-fg" fill="currentColor" aria-hidden="true">
                <path d="M9.6 6C6.5 7.3 4.5 10 4.5 13.6V18h5.6v-5.6H7.4c.1-2 1.2-3.6 3.2-4.6L9.6 6zm9 0c-3.1 1.3-5.1 4-5.1 7.6V18h5.6v-5.6h-2.7c.1-2 1.2-3.6 3.2-4.6L18.6 6z" />
              </svg>
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
                    {t.role} <span className="whitespace-nowrap">· {t.city}</span>
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
