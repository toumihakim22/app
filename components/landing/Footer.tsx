import Logo from "./Logo";

const cols = [
  {
    title: "Plateforme",
    links: [
      { label: "Campagnes", href: "#campagnes" },
      { label: "Devenir Clipper", href: "#inscription", route: "inscription" },
      { label: "Se connecter", href: "#inscription", route: "connexion" },
      { label: "Pour les marques", href: "#marques" },
      { label: "Créer un compte agence", href: "#inscription", route: "inscription-agence" },
    ],
  },
  {
    title: "Ressources",
    links: [
      { label: "Comment ça marche", href: "#comment-ca-marche" },
      { label: "FAQ", href: "#faq" },
      { label: "Administration", href: "#inscription", route: "connexion" },
    ],
  },
  {
    title: "Légal",
    links: [
      { label: "Conditions d'utilisation", href: "#" },
      { label: "Confidentialité", href: "#" },
      { label: "Mentions légales", href: "#" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_repeat(3,1fr)] lg:px-8">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-gray-500">
            La plateforme de clipping qui connecte les créateurs et les marques en Algérie.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <p className="text-sm font-bold text-ink">{c.title}</p>
            <ul className="mt-4 space-y-3">
              {c.links.map((l) => (
                <li key={l.label}>
                  <a href={l.href} data-route={"route" in l ? l.route : undefined} className="text-sm text-gray-500 transition hover:text-ink">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-100">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-gray-400 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
          <p>© 2026 ClipBoost. Tous droits réservés.</p>
          <p>Maquette de démonstration : toutes les données affichées sont fictives.</p>
        </div>
      </div>
    </footer>
  );
}
