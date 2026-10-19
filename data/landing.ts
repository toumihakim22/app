// Données fictives utilisées uniquement pour la démonstration de la landing page.
// Typographie (§3.3) : espace insécable U+00A0 dans les nombres, les dates et avant « ? », « : » et « % ».

export type Transaction = {
  date: string;
  time: string;
  amount: number;
  status: "En cours" | "Validé";
};

export const transactions: Transaction[] = [
  { date: "09\u00a0oct.\u00a02026", time: "17:01", amount: 2850, status: "En cours" },
  { date: "07\u00a0oct.\u00a02026", time: "16:33", amount: 8755, status: "Validé" },
  { date: "05\u00a0oct.\u00a02026", time: "13:04", amount: 18755, status: "Validé" },
];

export const incomeCurve = [8, 9, 12, 18, 24, 27, 27, 26, 29, 33, 35, 33, 27];

export const stats = [
  { value: "12\u00a0400+", label: "clippers inscrits" },
  { value: "3,2\u00a0M", label: "vues générées par mois" },
  { value: "4", label: "plateformes prises en charge" },
  { value: "180+", label: "campagnes lancées" },
];

// Le champ `icon` n'est plus affiché (HowItWorks choisit une icône au trait par index).
export const steps = [
  {
    title: "Choisissez une campagne",
    text: "Parcourez les campagnes des marques, comparez la rémunération pour 1\u00a0000\u00a0vues et sélectionnez celles qui collent à votre style.",
    icon: "🎯",
  },
  {
    title: "Publiez vos clips",
    text: "Découpez, montez et publiez vos clips sur TikTok, Instagram, YouTube Shorts ou Facebook avec votre lien de suivi.",
    icon: "🎬",
  },
  {
    title: "Encaissez vos gains",
    text: "Vos vues sont comptabilisées et vos gains s'affichent dans votre portefeuille, campagne par campagne.",
    icon: "💸",
  },
];

export const testimonials = [
  {
    name: "Yacine B.",
    role: "Clipper gaming",
    quote:
      "J'ai commencé avec deux clips par jour. Aujourd'hui je suis mes gains campagne par campagne et je sais exactement ce qui marche.",
    initials: "YB",
  },
  {
    name: "Amira K.",
    role: "Créatrice lifestyle",
    quote:
      "Les campagnes sont claires\u00a0: on voit le tarif, les règles et les vues. Plus besoin de négocier chaque collaboration.",
    initials: "AK",
  },
  {
    name: "Studio Nova",
    role: "Marque partenaire",
    quote:
      "On a touché un public jeune dans tout le pays en quelques jours, avec des dizaines de clippers qui parlent comme notre audience.",
    initials: "SN",
  },
];

export const faqs = [
  {
    q: "Qui peut devenir clipper sur ClipBoost\u00a0?",
    a: "Toute personne majeure qui publie des vidéos courtes sur TikTok, Instagram, YouTube Shorts ou Facebook. Aucun nombre minimum d'abonnés n'est demandé pour commencer.",
  },
  {
    q: "Comment sont calculés mes gains\u00a0?",
    a: "Chaque campagne affiche un tarif pour 1\u00a0000\u00a0vues. Vos gains correspondent aux vues validées de vos clips multipliées par ce tarif.",
  },
  {
    q: "Quand vais-je recevoir mon argent\u00a0?",
    a: "Vos gains validés sont libérés après 3\u00a0jours de contrôle. Vous pouvez les retirer dès 2\u00a0000\u00a0DA vers le moyen de retrait enregistré dans votre portefeuille.",
  },
  {
    q: "Je suis une marque, comment lancer une campagne\u00a0?",
    a: "Vous définissez votre budget, le tarif pour 1\u00a0000\u00a0vues et vos consignes. Les clippers s'inscrivent et vous suivez les résultats en temps réel.",
  },
];

const NB = "\u00a0", MINUS = "\u2212";

/**
 * Montant en dinars (§3.3) : entier, milliers séparés par U+00A0, U+00A0 avant « DA », vrai signe moins (U+2212).
 * `signed` : « + » collé devant un montant positif (historiques, gains générés). Même appel formatDA(n) qu'avant.
 */
export function formatDA(value: number, { signed = false }: { signed?: boolean } = {}) {
  // Formatage manuel (même rendu serveur et navigateur) : espace insécable, vrai signe moins.
  const abs = String(Math.round(Math.abs(value))).replace(/\B(?=(\d{3})+(?!\d))/g, NB);
  return `${value < 0 ? MINUS : signed && value > 0 ? "+" : ""}${abs}${NB}DA`;
}
