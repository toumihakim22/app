// CTA final (§7.11) : panneau toujours sombre (bg-night, fixe) avec les 2 halos autorisés (§8), titre et boutons.
// Le filet night-line détache le panneau du fond en mode sombre (surface #12151c ≈ night #11141b).
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
const BTN = `inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors duration-150 ease-standard ${FOCUS}`;
const LG = "h-12 rounded-control px-5 text-[15px] [&_svg]:size-5";
const PRIMARY = "bg-brand text-on-brand shadow-control hover:bg-brand-hover active:bg-brand-active";
const ON_COLOR_GHOST = "bg-on-brand/10 text-on-brand ring-1 ring-inset ring-on-brand/25 hover:bg-on-brand/15";

export default function FinalCta() {
  return (
    <section id="inscription" className="scroll-mt-20 bg-surface py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-panel border border-night-line bg-night px-6 py-16 text-center sm:px-12 lg:py-20">
          <div className="pointer-events-none absolute -left-20 -top-24 size-80 rounded-full bg-brand/30 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-28 -right-10 size-80 rounded-full bg-night-income/15 blur-3xl" aria-hidden="true" />
          <h2 className="relative mx-auto max-w-2xl text-h2 text-on-brand lg:text-h1">Prêt à faire décoller vos clips&nbsp;?</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-lg leading-8 text-on-brand/80">
            Inscription gratuite, premiers gains dès le premier clip validé.
          </p>
          <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a href="/espace#/inscription" className={`${BTN} ${LG} ${PRIMARY}`}>
              Devenir clipper
            </a>
            <a href="/espace#/inscription-agence" className={`${BTN} ${LG} ${ON_COLOR_GHOST}`}>
              Lancer une campagne
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
