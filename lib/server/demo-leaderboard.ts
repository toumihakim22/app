// Données d'exemple uniquement : clippers de plus pour peupler le classement hebdomadaire (un clip validé chacun, avec
// l'historique de ses relevés), et clôture de la semaine écoulée (primes déjà versées). Partagées par scripts/seed.mts et
// la version autonome (web/offline/seed.ts).
import { PRIZE_RANKS, weekBounds, weekGains, weekKey, weeklyRanking, weekStart, type WeekReading } from "./rules";

/** campaign : clé de la campagne d'exemple (derby, kahwa, rire) ; days : validé il y a `days` jours (envoyé la veille). */
export type DemoContender = {
  name: string; email: string; level: string; createdDaysAgo: number; handle: string; platform: "TikTok" | "Instagram" | "YouTube"; verifiedDaysAgo: number;
  clip: { campaign: "derby" | "kahwa" | "rire"; title: string; views: number; days: number };
};

/** Cinq clippers de plus, aux clips validés à des dates différentes : la semaine en cours et la précédente ont des vues. */
export const DEMO_CONTENDERS: DemoContender[] = [
  { name: "Sofiane Haddad", email: "sofiane@clipboost.dz", level: "Clipper Argent", createdDaysAgo: 150, handle: "sofiane.edits", platform: "TikTok", verifiedDaysAgo: 60, clip: { campaign: "derby", title: "Les plus beaux arrêts du gardien", views: 39500, days: 3 } },
  { name: "Nour El Houda Saidi", email: "nour@clipboost.dz", level: "Clipper Bronze", createdDaysAgo: 120, handle: "nour.vibes", platform: "Instagram", verifiedDaysAgo: 50, clip: { campaign: "kahwa", title: "Café et croissant au ralenti", views: 21400, days: 4 } },
  { name: "Karim Belkacem", email: "karim@clipboost.dz", level: "Clipper Argent", createdDaysAgo: 95, handle: "karimfun", platform: "YouTube", verifiedDaysAgo: 40, clip: { campaign: "rire", title: "Le prof de maths le jour du bac", views: 27300, days: 6 } },
  { name: "Imane Cherif", email: "imane@clipboost.dz", level: "Clipper Bronze", createdDaysAgo: 80, handle: "imane.daily", platform: "TikTok", verifiedDaysAgo: 35, clip: { campaign: "kahwa", title: "Ma routine du matin", views: 14800, days: 10 } },
  { name: "Rayan Touati", email: "rayan@clipboost.dz", level: "Nouveau", createdDaysAgo: 45, handle: "rayan.foot", platform: "TikTok", verifiedDaysAgo: 30, clip: { campaign: "derby", title: "Le chant des supporters en 4K", views: 25600, days: 1 } },
];

/**
 * Clôture de la semaine écoulée des données d'exemple, faite par le relevé de lundi 01:00 (heure d'Alger, au plus tard
 * maintenant) avec les mêmes règles que closeWeek : rangs classés du top 10 et prime de chacun (`prizes`).
 */
export function demoLastWeek(input: { now: number; clips: { id: string; userId: string; status: string }[]; readings: WeekReading[]; clippers: { id: string; createdAt: number; status: string }[]; prizes: number[] }) {
  const week = weekKey(weekStart(input.now) - 1), { start, end } = weekBounds(week)!;
  const awards = weeklyRanking(input.clips, weekGains(input.readings, start, end), input.clippers, input.prizes).slice(0, PRIZE_RANKS);
  return { week, closedAt: Math.min(end + 3_600_000, input.now), awards };
}
