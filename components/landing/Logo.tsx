export default function Logo({ className = "" }: { className?: string }) {
  return (
    <a href="#" className={`inline-flex items-center gap-2 ${className}`} aria-label="ClipBoost, accueil">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/30">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
          <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
        </svg>
      </span>
      <span className="text-2xl font-black italic tracking-tight text-ink">ClipBoost</span>
    </a>
  );
}
