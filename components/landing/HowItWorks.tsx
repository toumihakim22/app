import { steps } from "@/data/landing";
import SectionTitle from "./SectionTitle";

export default function HowItWorks() {
  return (
    <section id="comment-ca-marche" className="scroll-mt-20 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionTitle
          center
          eyebrow="Comment ça marche"
          title="Trois étapes pour être payé à la vue"
          text="Pas de négociation, pas d'attente : les règles de chaque campagne sont visibles dès le départ."
        />
        <ol className="mt-14 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="relative rounded-3xl bg-gray-50 p-7 ring-1 ring-gray-100">
              <div className="flex items-center justify-between">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-2xl shadow-sm ring-1 ring-gray-100" aria-hidden="true">
                  {s.icon}
                </span>
                <span className="text-5xl font-black text-gray-200">0{i + 1}</span>
              </div>
              <h3 className="mt-6 text-xl font-bold text-ink">{s.title}</h3>
              <p className="mt-3 leading-relaxed text-gray-600">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
