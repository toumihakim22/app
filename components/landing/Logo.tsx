// Logo ClipBoost (§7.2, §8) : symbole « play » blanc sur carré violet + mot-symbole Plus Jakarta Sans 800,
// oblique contrôlé par -skew-x-6. Le mot-symbole suit text-fg : il bascule seul en sombre. Utilisé aussi par Footer.
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export default function Logo({ className }: { className?: string }) {
  return (
    <a href="/" className={`inline-flex items-center gap-2.5 rounded-control ${FOCUS} ${className ?? ""}`} aria-label="ClipBoost, accueil">
      <span className="grid size-9 shrink-0 place-items-center rounded-tile bg-brand text-on-brand">
        <svg viewBox="0 0 24 24" className="size-[18px] translate-x-px" fill="currentColor" aria-hidden="true">
          <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
        </svg>
      </span>
      <span className="inline-block -skew-x-6 font-display text-[1.375rem] font-extrabold leading-none tracking-[-0.03em] text-fg" aria-hidden="true">
        ClipBoost
      </span>
    </a>
  );
}
