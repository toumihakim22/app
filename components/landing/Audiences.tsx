import SectionTitle from "./SectionTitle";

const clipper = [
  "Inscription gratuite, sans minimum d'abonnés",
  "Campagnes dans le sport, la food, la tech, la mode et la musique",
  "Liens de suivi uniques pour chaque clip",
  "Tableau de bord de vos vues et de vos gains",
];

const brand = [
  "Budget maîtrisé : vous payez uniquement les vues obtenues",
  "Des centaines de créateurs dans les 48 wilayas",
  "Consignes et validation des clips avant diffusion",
  "Statistiques détaillées par clip et par créateur",
];

function Check({ dark = false }: { dark?: boolean }) {
  return (
    <span
      className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${dark ? "bg-white/15 text-white" : "bg-brand-50 text-brand-600"}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12l5 5L20 7" />
      </svg>
    </span>
  );
}

export default function Audiences() {
  return (
    <section id="marques" className="scroll-mt-20 bg-gray-50 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionTitle center eyebrow="Pour tout le monde" title="Clippers et marques, gagnant-gagnant" />
        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-100 sm:p-10">
            <span className="text-3xl" aria-hidden="true">🎬</span>
            <h3 className="mt-4 text-2xl font-extrabold text-ink">Vous êtes Clipper</h3>
            <p className="mt-2 text-gray-600">Monétisez votre talent de montage avec des campagnes prêtes à l&apos;emploi.</p>
            <ul className="mt-7 space-y-4">
              {clipper.map((item) => (
                <li key={item} className="flex gap-3 text-gray-700">
                  <Check />
                  {item}
                </li>
              ))}
            </ul>
            <a href="#inscription" data-route="inscription" className="mt-9 inline-block rounded-2xl bg-ink px-6 py-3.5 font-semibold text-white transition hover:bg-black">
              + Devenir Clipper
            </a>
          </div>
          <div className="rounded-3xl bg-brand-600 p-8 text-white shadow-lg shadow-brand-600/25 sm:p-10">
            <span className="text-3xl" aria-hidden="true">🏢</span>
            <h3 className="mt-4 text-2xl font-extrabold">Vous êtes une marque</h3>
            <p className="mt-2 text-white/80">Faites parler de vous partout en Algérie grâce à des créateurs authentiques.</p>
            <ul className="mt-7 space-y-4">
              {brand.map((item) => (
                <li key={item} className="flex gap-3 text-white/90">
                  <Check dark />
                  {item}
                </li>
              ))}
            </ul>
            <a href="#inscription" data-route="inscription-agence" className="mt-9 inline-block rounded-2xl bg-white px-6 py-3.5 font-semibold text-brand-700 transition hover:bg-brand-50">
              Lancer une campagne <span aria-hidden="true">🚀</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
