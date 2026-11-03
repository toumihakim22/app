import Logo from "./Logo";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

const cols = [
  {
    title: "Plateforme",
    links: [
      { label: "Devenir clipper", href: "/espace#/inscription" },
      { label: "Se connecter", href: "/espace#/connexion" },
      { label: "Pour les marques", href: "#marques" },
      { label: "Créer un compte agence", href: "/espace#/inscription-agence" },
    ],
  },
  {
    title: "Ressources",
    links: [
      { label: "Comment ça marche", href: "#comment-ca-marche" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Légal",
    links: [
      { label: "Conditions d'utilisation", href: "#conditions" },
      { label: "Confidentialité", href: "#confidentialite" },
      { label: "Mentions légales", href: "#mentions-legales" },
    ],
  },
];

// Textes légaux courts, ciblés par les liens « Légal » et par la case des conditions de l'inscription (/#conditions).
const legal = [
  {
    id: "conditions",
    title: "Conditions d'utilisation",
    text: "ClipBoost met en relation des clippers et des marques. Les gains sont calculés sur les vues des clips validés, selon le tarif, le seuil et le plafond de chaque campagne, puis restent quelques jours en rétention avant d'être retirables. Un clip qui ne respecte pas les règles de sa campagne ou dont les vues sont gonflées artificiellement est refusé, et le compte peut être suspendu.",
  },
  {
    id: "confidentialite",
    title: "Confidentialité",
    text: "Nous ne collectons que les données utiles au service : nom, email, pays, liens des clips publiés et coordonnées de paiement. Elles servent à vérifier les clips et à verser les gains, ne sont jamais revendues et sont supprimées sur simple demande avec le compte.",
  },
  {
    id: "mentions-legales",
    title: "Mentions légales",
    text: "ClipBoost est une plateforme de mise en relation entre créateurs de clips et marques. Les marques citées sur cette page appartiennent à leurs propriétaires respectifs.",
  },
];

// Pied de page (§7.11). Les liens absolus restent /espace#/… : la version hors ligne les convertit en ancres.
export default function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-10 py-14 md:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div className="col-span-2 md:col-span-1">
            <Logo />
            <p className="mt-4 max-w-xs text-small text-fg-muted">La plateforme de clipping qui connecte les créateurs et les marques.</p>
          </div>
          {cols.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <p className="text-small font-semibold text-fg">{c.title}</p>
              <ul className="mt-3 grid gap-1 md:mt-4 md:gap-3">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className={`inline-flex min-h-10 items-center rounded-sm text-small md:min-h-0 text-fg-muted transition-colors duration-150 hover:text-fg ${FOCUS}`}>
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="grid gap-6 border-t border-line py-10 md:grid-cols-3 md:gap-10">
          {legal.map((l) => (
            <section key={l.id} id={l.id} aria-labelledby={`${l.id}-titre`} className="scroll-mt-20">
              <h2 id={`${l.id}-titre`} className="font-sans text-small font-semibold text-fg">
                {l.title}
              </h2>
              <p className="mt-2 text-xs leading-5 text-fg-muted">{l.text}</p>
            </section>
          ))}
        </div>
        <div className="flex flex-col gap-3 border-t border-line py-6 text-xs text-fg-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 ClipBoost</p>
        </div>
      </div>
    </footer>
  );
}
