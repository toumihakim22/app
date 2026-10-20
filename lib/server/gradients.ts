export const GRADIENTS = [
  "from-emerald-400 via-teal-500 to-cyan-600",
  "from-violet-500 via-fuchsia-500 to-pink-500",
  "from-amber-300 via-orange-400 to-rose-500",
  "from-sky-400 via-blue-500 to-indigo-600",
  "from-lime-300 via-green-400 to-emerald-600",
  "from-rose-400 via-pink-500 to-purple-600",
];
/**
 * Catégories proposées à la création d'une campagne. « Autre » n'est jamais enregistrée telle quelle :
 * l'agence précise alors sa propre catégorie (texte libre, voir campaignSchema), affichée et filtrée comme les autres.
 */
export const CATEGORIES = [
  "Sport", "Food", "Tech", "Mode", "Beauté", "Musique", "Humour", "Gaming", "Cinéma", "Voyage",
  "Automobile", "Éducation", "Santé", "Finance", "Immobilier", "Lifestyle", "Événementiel", "Autre",
];
export const PLATFORMS = ["TikTok", "Instagram", "YouTube", "Facebook"];
/** Le lien d'un clip doit pointer vers la plateforme déclarée (https uniquement). Partagé par l'API, la version autonome et l'app. */
export const PLATFORM_HOSTS: Record<string, RegExp> = {
  TikTok: /(^|\.)tiktok\.com$/,
  Instagram: /(^|\.)instagram\.com$/,
  YouTube: /(^|\.)(youtube\.com|youtu\.be)$/,
  Facebook: /(^|\.)(facebook\.com|fb\.watch|fb\.com)$/,
};
