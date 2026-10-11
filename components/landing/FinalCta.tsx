export default function FinalCta() {
  return (
    <section id="inscription" className="scroll-mt-20 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-ink px-6 py-16 text-center sm:px-12 lg:py-20">
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-600/40 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-income/40 blur-3xl" aria-hidden="true" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              Prêt à faire décoller vos clips ?
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-white/70">
              Rejoignez la liste d&apos;attente et soyez parmi les premiers clippers et marques sur ClipBoost.
            </p>
            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
              <a href="#" className="rounded-2xl bg-brand-600 px-8 py-4 font-semibold text-white shadow-lg shadow-brand-600/40 transition hover:bg-brand-500">
                + Devenir Clipper
              </a>
              <a href="#" className="rounded-2xl bg-white/10 px-8 py-4 font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/15">
                Je suis une marque
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
