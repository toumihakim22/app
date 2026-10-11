import Logo from "./Logo";

const cols = [
  { title: "Plateforme", links: ["Campagnes", "Devenir Clipper", "Pour les marques", "Tarifs"] },
  { title: "Ressources", links: ["Guide du clipper", "FAQ", "Blog", "Contact"] },
  { title: "Légal", links: ["Conditions d'utilisation", "Confidentialité", "Mentions légales"] },
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
                <li key={l}>
                  <a href="#" className="text-sm text-gray-500 transition hover:text-ink">
                    {l}
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
