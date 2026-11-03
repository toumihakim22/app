// Données d'exemple uniquement : une leçon de l'Académie en brouillon (non publiée, donc invisible pour les clippers),
// écrite en français seulement (l'anglais et l'arabe affichent le français). Partagée par scripts/seed.mts et la version
// autonome (web/offline/seed.ts) ; les cinq leçons publiées viennent de lib/server/academy-lessons.ts.
import type { StarterLesson } from "./academy-lessons";

export const DEMO_DRAFT_LESSON: StarterLesson = {
  id: "demo-plusieurs-plateformes", category: "Formats", emoji: "📲", minutes: 2, videoUrl: "https://www.youtube.com/@CapCut", position: 6, published: false,
  title: { fr: "Un clip, plusieurs plateformes" },
  summary: { fr: "Adapter le même montage à TikTok, Instagram et YouTube sans perdre de temps." },
  body: {
    fr: [
      "Un même montage peut être publié sur chaque plateforme acceptée par la campagne, à condition de l'adapter un peu.",
      "",
      "- Exportez sans filigrane : un logo TikTok sur Instagram ou YouTube est moins diffusé.",
      "- Changez la légende et les hashtags pour chaque plateforme.",
      "- Soumettez un lien par plateforme dans le même envoi.",
    ].join("\n"),
  },
};
