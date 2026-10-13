"use client";

// Bascule clair / sombre. La classe .dark sur <html> ne fait que redéfinir les variables de couleur
// (app/dark.css ne contient plus que des variables) : les utilitaires sémantiques (bg-surface, text-fg…)
// basculent seuls. Le choix est mémorisé dans le navigateur. Dans la version hors ligne (HTML autonome,
// sans React), ce bouton est piloté par web/theme.js via l'attribut data-theme-toggle.
export function toggleTheme() {
  const dark = document.documentElement.classList.toggle("dark");
  try {
    localStorage.setItem("clipboost-theme", dark ? "dark" : "light");
  } catch {
    // stockage indisponible (navigation privée) : le choix vaut pour la page en cours
  }
}

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export default function ThemeToggle() {
  return (
    <button
      type="button"
      data-theme-toggle
      onClick={toggleTheme}
      className={`inline-grid size-10 shrink-0 place-items-center rounded-lg text-fg-muted transition-colors hover:bg-muted hover:text-fg ${FOCUS} [&_svg]:size-5`}
      aria-label="Changer de thème (clair ou sombre)"
      title="Mode clair / sombre"
    >
      {/* Lune en clair, soleil en sombre : seule exception autorisée aux variantes sombres (§1.2). */}
      <svg viewBox="0 0 24 24" className="dark:hidden" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
      <svg viewBox="0 0 24 24" className="hidden dark:block" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>
  );
}
