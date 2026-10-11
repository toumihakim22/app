import { faqs } from "@/data/landing";
import SectionTitle from "./SectionTitle";

export default function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 bg-gray-50 py-20 lg:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionTitle center eyebrow="FAQ" title="Questions fréquentes" />
        <div className="mt-12 space-y-3">
          {faqs.map((f) => (
            <details key={f.q} className="group rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 open:ring-brand-100">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gray-50 text-gray-500 transition group-open:rotate-45 group-open:bg-brand-50 group-open:text-brand-600" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="mt-4 leading-relaxed text-gray-600">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
