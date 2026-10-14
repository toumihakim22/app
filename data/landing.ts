// Données fictives utilisées uniquement pour la démonstration de la landing page.
// Typographie (§3.3) : espace insécable U+00A0 dans les nombres, les dates et avant « ? », « : » et « % ».

export type CampaignCategory = "Sport" | "Food" | "Tech" | "Mode" | "Musique";

export type Campaign = {
  id: string;
  title: string;
  brand: string;
  category: CampaignCategory;
  ratePer1k: number; // en DA pour 1 000 vues
  createdAt: string;
  generated: number; // en DA
  topCampaign?: boolean;
  gradient: string; // conservé dans cette passe, plus lu : la couverture vient de .cover[data-cat] (app/theme.css)
  emoji: string;
};

export const campaigns: Campaign[] = [
  {
    id: "derby-algerois",
    title: "Derby Algérois",
    brand: "Tassili Sport",
    category: "Sport",
    ratePer1k: 150,
    createdAt: "02\u00a0oct.\u00a02026 · 18:30",
    generated: 184500,
    topCampaign: true,
    gradient: "from-emerald-400 via-teal-500 to-cyan-600",
    emoji: "⚽",
  },
  {
    id: "kahwa-matin",
    title: "Kahwa du matin",
    brand: "Kahwa Lounge",
    category: "Food",
    ratePer1k: 110,
    createdAt: "28\u00a0sept.\u00a02026 · 09:15",
    generated: 62300,
    gradient: "from-amber-300 via-orange-400 to-rose-500",
    emoji: "☕",
  },
  {
    id: "unboxing-sahara",
    title: "Unboxing Sahara X",
    brand: "Sahara Tech",
    category: "Tech",
    ratePer1k: 130,
    createdAt: "25\u00a0sept.\u00a02026 · 21:00",
    generated: 97800,
    topCampaign: true,
    gradient: "from-sky-400 via-indigo-500 to-violet-600",
    emoji: "📱",
  },
  {
    id: "casbah-streetfood",
    title: "Casbah Street Food",
    brand: "Casbah Food",
    category: "Food",
    ratePer1k: 120,
    createdAt: "20\u00a0sept.\u00a02026 · 13:45",
    generated: 45200,
    gradient: "from-red-400 via-orange-500 to-yellow-400",
    emoji: "🥙",
  },
  {
    id: "atlas-collection",
    title: "Collection Atlas",
    brand: "Atlas Mode",
    category: "Mode",
    ratePer1k: 140,
    createdAt: "18\u00a0sept.\u00a02026 · 17:20",
    generated: 128900,
    topCampaign: true,
    gradient: "from-fuchsia-400 via-pink-500 to-rose-500",
    emoji: "🧥",
  },
  {
    id: "oran-beats",
    title: "Oran Beats Live",
    brand: "Oran Beats",
    category: "Musique",
    ratePer1k: 100,
    createdAt: "12\u00a0sept.\u00a02026 · 22:10",
    generated: 38700,
    gradient: "from-violet-500 via-purple-600 to-indigo-700",
    emoji: "🎧",
  },
];

export const categories: ("Toutes" | CampaignCategory)[] = [
  "Toutes",
  "Sport",
  "Food",
  "Tech",
  "Mode",
  "Musique",
];

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
  { value: "48", label: "wilayas représentées" },
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
    text: "Découpez, montez et publiez vos clips sur TikTok, Instagram ou YouTube Shorts avec votre lien de suivi.",
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
    city: "Alger",
    role: "Clipper gaming",
    quote:
      "J'ai commencé avec deux clips par jour. Aujourd'hui je suis mes gains campagne par campagne et je sais exactement ce qui marche.",
    initials: "YB",
  },
  {
    name: "Amira K.",
    city: "Oran",
    role: "Créatrice lifestyle",
    quote:
      "Les campagnes sont claires\u00a0: on voit le tarif, les règles et les vues. Plus besoin de négocier chaque collaboration.",
    initials: "AK",
  },
  {
    name: "Studio Numidia",
    city: "Constantine",
    role: "Marque partenaire",
    quote:
      "On a touché un public jeune dans tout le pays en quelques jours, avec des dizaines de clippers qui parlent comme notre audience.",
    initials: "SN",
  },
];

export const faqs = [
  {
    q: "Qui peut devenir clipper sur ClipBoost\u00a0?",
    a: "Toute personne majeure qui publie des vidéos courtes sur TikTok, Instagram ou YouTube Shorts. Aucun nombre minimum d'abonnés n'est demandé pour commencer.",
  },
  {
    q: "Comment sont calculés mes gains\u00a0?",
    a: "Chaque campagne affiche un tarif pour 1\u00a0000\u00a0vues. Vos gains correspondent aux vues validées de vos clips multipliées par ce tarif.",
  },
  {
    q: "Quand vais-je recevoir mon argent\u00a0?",
    a: "Vos gains validés sont libérés après 3\u00a0jours de contrôle. Vous pouvez les retirer dès 2\u00a0000\u00a0DA vers BaridiMob, CCP ou un compte bancaire (RIB).",
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
