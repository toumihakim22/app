"use client";

// Bascule clair / sombre. La classe .dark sur <html> active les styles de app/dark.css ;
// le choix est mémorisé dans le navigateur. Dans la version HTML autonome, ce bouton est
// piloté par standalone/landing.js via l'attribut data-theme-toggle.
export function toggleTheme() {
  const dark = document.documentElement.classList.toggle("dark");
  try {
    localStorage.setItem("clipboost-theme", dark ? "dark" : "light");
  } catch {
    // stockage indisponible (navigation privée) : le choix vaut pour la page en cours
  }
}

export default function ThemeToggle() {
  return (
    <button
      type="button"
      data-theme-toggle
      onClick={toggleTheme}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-gray-200 text-ink transition hover:bg-gray-50"
      aria-label="Changer de thème (clair ou sombre)"
      title="Mode clair / sombre"
    >
      <svg viewBox="0 0 24 24" className="theme-moon h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
      <svg viewBox="0 0 24 24" className="theme-sun h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>
  );
}
