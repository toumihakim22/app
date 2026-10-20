// Titre de section du landing (§7.5) : surtitre, h2 (Plus Jakarta Sans par la couche base), chapô.
// Toujours centré ; pour l'aligner à gauche, envelopper avec [&>div]:mx-0 [&>div]:text-left.
// `center` reste accepté pour compatibilité, il n'a plus d'effet.
// Plus Jakarta Sans n'a pas de crénage « e, » : sans correction, la virgule d'un titre semble précédée d'une espace.
const tightPunct = (t: string) =>
  t.split(/(,)/).map((part, i) => (part === "," ? <span key={i} className="-ml-[0.07em]">,</span> : part));

export default function SectionTitle({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text?: string;
  center?: boolean;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-small font-semibold uppercase tracking-[0.08em] text-brand-fg">{eyebrow}</p>
      <h2 className="mt-3 text-h2 text-fg [word-spacing:0.05em] lg:text-h1">{tightPunct(title)}</h2>
      {text && <p className="mt-4 text-lg leading-8 text-fg-muted">{text}</p>}
    </div>
  );
}
