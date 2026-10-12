// Données fictives utilisées uniquement pour la démonstration de la landing page.

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
  gradient: string;
  emoji: string;
};

export const campaigns: Campaign[] = [
  {
    id: "derby-algerois",
    title: "Derby Algérois",
    brand: "Tassili Sport",
    category: "Sport",
    ratePer1k: 150,
    createdAt: "02 oct. 2026 · 18:30",
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
    createdAt: "28 sept. 2026 · 09:15",
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
    createdAt: "25 sept. 2026 · 21:00",
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
    createdAt: "20 sept. 2026 · 13:45",
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
    createdAt: "18 sept. 2026 · 17:20",
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
    createdAt: "12 sept. 2026 · 22:10",
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
  { date: "09 oct. 2026", time: "17:01", amount: 2850, status: "En cours" },
  { date: "07 oct. 2026", time: "16:33", amount: 8755, status: "Validé" },
  { date: "05 oct. 2026", time: "13:04", amount: 18755, status: "Validé" },
];

export const incomeCurve = [8, 9, 12, 18, 24, 27, 27, 26, 29, 33, 35, 33, 27];

export const stats = [
  { value: "12 400+", label: "clippers inscrits" },
  { value: "3,2 M", label: "vues générées par mois" },
  { value: "48", label: "wilayas représentées" },
  { value: "180+", label: "campagnes lancées" },
];

export const steps = [
  {
    title: "Choisissez une campagne",
    text: "Parcourez les campagnes des marques, comparez la rémunération pour 1 000 vues et sélectionnez celles qui collent à votre style.",
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
      "Les campagnes sont claires : on voit le tarif, les règles et les vues. Plus besoin de négocier chaque collaboration.",
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
    q: "Qui peut devenir Clipper sur ClipBoost ?",
    a: "Toute personne majeure qui publie des vidéos courtes sur TikTok, Instagram ou YouTube Shorts. Aucun nombre minimum d'abonnés n'est demandé pour commencer.",
  },
  {
    q: "Comment sont calculés mes gains ?",
    a: "Chaque campagne affiche un tarif pour 1 000 vues. Vos gains correspondent aux vues validées de vos clips multipliées par ce tarif.",
  },
  {
    q: "Quand vais-je recevoir mon argent ?",
    a: "Les gains validés apparaissent dans votre portefeuille. Les modalités de retrait seront précisées au lancement de la plateforme.",
  },
  {
    q: "Je suis une marque, comment lancer une campagne ?",
    a: "Vous définissez votre budget, le tarif pour 1 000 vues et vos consignes. Les clippers s'inscrivent et vous suivez les résultats en temps réel.",
  },
];

export function formatDA(value: number) {
  // Formatage manuel pour garantir le même rendu côté serveur et navigateur.
  return `${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} DA`;
}
