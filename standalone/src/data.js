// Données du site, en mémoire.

const CATEGORIES = ["Sport", "Food", "Tech", "Mode", "Musique", "Humour"];
const COUNTRIES = ["Algérie", "Maroc", "Tunisie", "Libye", "Mauritanie", "Égypte", "France", "Belgique", "Suisse", "Canada", "Sénégal", "Côte d'Ivoire", "Arabie saoudite", "Émirats arabes unis", "Qatar", "Autre"];
const TODAY = "2026-10-11";

const db = {
  settings: {
    maintenance: false,
    signupsOpen: true,
    minWithdraw: 1000,
    announcement: "",
  },

  users: [
    { id: 1, role: "clipper", name: "Yacine Benali", email: "yacine@clipboost.dz", password: "clipper123", country: "Algérie", status: "Actif", joined: "2026-03-14", verified: true, level: "Clipper Argent", bio: "Monteur passionné de foot et d'humour. Je publie 2 à 3 clips par jour.", handle: "@yacine.clips", baseEarned: 857500, baseBalance: 41200, viewsFactor: 1, favorites: new Set(["derby", "atlas"]), joinedCampaigns: new Set(["derby", "atlas", "sahara", "kahwa", "rire", "casbah"]) },
    { id: 2, role: "clipper", name: "Amira Khelifi", email: "amira@clipboost.dz", password: "clipper123", country: "Algérie", status: "Actif", joined: "2026-04-02", verified: true, level: "Clipper Or", bio: "Lifestyle et mode à Oran.", handle: "@amira.style", baseEarned: 1240000, baseBalance: 64000, viewsFactor: 1.4, favorites: new Set(["atlas"]), joinedCampaigns: new Set(["atlas", "kahwa", "casbah"]) },
    { id: 3, role: "clipper", name: "Karim Haddad", email: "karim@clipboost.dz", password: "clipper123", country: "Algérie", status: "Suspendu", joined: "2026-05-20", verified: true, level: "Clipper Bronze", bio: "Gaming et tech.", handle: "@karim.gg", baseEarned: 98000, baseBalance: 5400, viewsFactor: 0.3, favorites: new Set(), joinedCampaigns: new Set(["gaming", "sahara"]) },
    { id: 4, role: "clipper", name: "Lina Mansouri", email: "lina@clipboost.dz", password: "clipper123", country: "Algérie", status: "Actif", joined: "2026-08-11", verified: true, level: "Clipper Bronze", bio: "Humour et sketchs.", handle: "@lina.lol", baseEarned: 154000, baseBalance: 12800, viewsFactor: 0.6, favorites: new Set(["rire"]), joinedCampaigns: new Set(["rire", "oran"]) },
    { id: 5, role: "clipper", name: "Sofiane Zerrouki", email: "sofiane@clipboost.dz", password: "clipper123", country: "Algérie", status: "Actif", joined: "2026-09-30", verified: false, level: "Nouveau", bio: "Football et ambiance stade.", handle: "@sofiane.foot", baseEarned: 0, baseBalance: 0, viewsFactor: 0.2, favorites: new Set(), joinedCampaigns: new Set(["derby"]) },
    { id: 50, role: "agence", name: "Tassili Sport", contact: "Nassim Ait Ali", email: "agence@clipboost.dz", password: "agence123", country: "Algérie", status: "Actif", joined: "2026-02-10", verified: true, credit: 150000 },
    { id: 51, role: "agence", name: "Hoggar Boissons", contact: "Meriem Saadi", email: "hoggar@clipboost.dz", password: "agence123", country: "Algérie", status: "Actif", joined: "2026-10-09", verified: true, credit: 0 },
    { id: 99, role: "admin", name: "Équipe ClipBoost", email: "admin@clipboost.dz", password: "admin123", country: "Algérie", status: "Actif", joined: "2026-01-01", verified: true },
  ],

  campaigns: [
    { id: "derby", ownerId: 50, title: "Derby Algérois", brand: "Tassili Sport", category: "Sport", rate: 150, budget: 600000, spent: 412000, clippers: 86, createdAt: "2026-10-02", status: "Active", top: true, gradient: "from-emerald-400 via-teal-500 to-cyan-600", emoji: "⚽", platforms: ["TikTok", "Instagram", "YouTube"], rules: ["Clip de 15 à 60 secondes", "Mentionner @tassilisport", "Pas de musique protégée"] },
    { id: "kahwa", title: "Kahwa du matin", brand: "Kahwa Lounge", category: "Food", rate: 110, budget: 250000, spent: 98000, clippers: 41, createdAt: "2026-09-28", status: "Active", gradient: "from-amber-300 via-orange-400 to-rose-500", emoji: "☕", platforms: ["TikTok", "Instagram"], rules: ["Montrer le produit dans les 3 premières secondes", "Ajouter #KahwaDuMatin"] },
    { id: "sahara", title: "Unboxing Sahara X", brand: "Sahara Tech", category: "Tech", rate: 130, budget: 400000, spent: 301000, clippers: 63, createdAt: "2026-09-25", status: "Active", top: true, gradient: "from-sky-400 via-indigo-500 to-violet-600", emoji: "📱", platforms: ["YouTube", "TikTok"], rules: ["Format vertical 9:16", "Afficher le logo Sahara X", "Durée minimale 20 secondes"] },
    { id: "casbah", title: "Casbah Street Food", brand: "Casbah Food", category: "Food", rate: 120, budget: 180000, spent: 45000, clippers: 22, createdAt: "2026-09-20", status: "Active", gradient: "from-red-400 via-orange-500 to-yellow-400", emoji: "🥙", platforms: ["TikTok", "Instagram"], rules: ["Tourné dans un lieu réel", "Mentionner l'adresse en description"] },
    { id: "atlas", title: "Collection Atlas", brand: "Atlas Mode", category: "Mode", rate: 140, budget: 350000, spent: 270000, clippers: 58, createdAt: "2026-09-18", status: "Active", top: true, gradient: "from-fuchsia-400 via-pink-500 to-rose-500", emoji: "🧥", platforms: ["Instagram", "TikTok"], rules: ["Porter au moins une pièce de la collection", "Ajouter #AtlasMode"] },
    { id: "oran", title: "Oran Beats Live", brand: "Oran Beats", category: "Musique", rate: 100, budget: 150000, spent: 38000, clippers: 19, createdAt: "2026-09-12", status: "Active", gradient: "from-violet-500 via-purple-600 to-indigo-700", emoji: "🎧", platforms: ["TikTok", "YouTube"], rules: ["Utiliser un extrait officiel", "Créditer l'artiste"] },
    { id: "rire", title: "Les Sketchs du Bled", brand: "Studio Numidia", category: "Humour", rate: 125, budget: 220000, spent: 120000, clippers: 47, createdAt: "2026-09-08", status: "Active", gradient: "from-lime-300 via-green-400 to-emerald-600", emoji: "😂", platforms: ["TikTok", "Instagram", "YouTube"], rules: ["Garder le sous-titrage", "Ne pas couper la chute"] },
    { id: "gaming", title: "Tournoi Djurdjura Gaming", brand: "Djurdjura Esport", category: "Tech", rate: 115, budget: 200000, spent: 64000, clippers: 30, createdAt: "2026-09-03", status: "Active", gradient: "from-slate-500 via-slate-700 to-ink", emoji: "🎮", platforms: ["YouTube", "TikTok"], rules: ["Montrer une action de jeu", "Lien du tournoi en bio"] },
    { id: "ramadan", ownerId: 51, title: "Spécial Soirées d'Été", brand: "Hoggar Boissons", category: "Food", rate: 135, budget: 500000, spent: 0, clippers: 0, createdAt: "2026-10-10", status: "En attente", gradient: "from-cyan-300 via-sky-500 to-blue-600", emoji: "🥤", platforms: ["TikTok", "Instagram"], rules: ["Montrer la bouteille", "Ambiance soirée entre amis"] },
    { id: "maillot", ownerId: 50, title: "Nouveau maillot 2027", brand: "Tassili Sport", category: "Sport", rate: 140, budget: 300000, spent: 96000, clippers: 34, createdAt: "2026-09-15", status: "En pause", gradient: "from-emerald-500 via-green-600 to-teal-700", emoji: "👕", platforms: ["Instagram", "TikTok"], rules: ["Porter le maillot à l'écran", "Mentionner @tassilisport"] },
    { id: "rentree", title: "Rentrée Étudiante", brand: "Librairie El Kalam", category: "Tech", rate: 90, budget: 80000, spent: 80000, clippers: 25, createdAt: "2026-08-25", status: "Terminée", gradient: "from-yellow-300 via-amber-400 to-orange-500", emoji: "📚", platforms: ["TikTok"], rules: ["Montrer un article de la librairie"] },
  ],

  publications: [
    { id: 1, userId: 1, campaign: "derby", title: "But de la 89e en slow-motion", platform: "TikTok", date: "2026-10-09", views: 48200, status: "Validée" },
    { id: 2, userId: 1, campaign: "atlas", title: "Look d'automne Atlas", platform: "Instagram", date: "2026-10-08", views: 21500, status: "Validée" },
    { id: 3, userId: 1, campaign: "sahara", title: "Unboxing en 30 secondes", platform: "YouTube", date: "2026-10-07", views: 15300, status: "En attente" },
    { id: 4, userId: 1, campaign: "kahwa", title: "Mon café du matin à Alger", platform: "TikTok", date: "2026-10-05", views: 9800, status: "Validée" },
    { id: 5, userId: 1, campaign: "rire", title: "Le taxi clandestin", platform: "TikTok", date: "2026-10-03", views: 63400, status: "Validée" },
    { id: 6, userId: 1, campaign: "casbah", title: "Garantita brûlante", platform: "Instagram", date: "2026-10-01", views: 4100, status: "Refusée", reason: "Lieu non visible à l'écran" },
    { id: 7, userId: 1, campaign: "derby", title: "Ambiance des tribunes", platform: "YouTube", date: "2026-09-29", views: 27700, status: "Validée" },
    { id: 8, userId: 2, campaign: "atlas", title: "3 tenues, 1 manteau", platform: "Instagram", date: "2026-10-10", views: 31200, status: "En attente" },
    { id: 9, userId: 2, campaign: "kahwa", title: "Brunch à Oran", platform: "TikTok", date: "2026-10-06", views: 18800, status: "Validée" },
    { id: 10, userId: 4, campaign: "rire", title: "Quand ta mère trouve ton bulletin", platform: "TikTok", date: "2026-10-10", views: 52900, status: "En attente" },
    { id: 11, userId: 5, campaign: "derby", title: "Les supporters chantent", platform: "TikTok", date: "2026-10-11", views: 1600, status: "En attente" },
    { id: 12, userId: 3, campaign: "gaming", title: "Clutch en finale", platform: "YouTube", date: "2026-09-20", views: 8800, status: "Validée" },
  ],

  transactions: [
    { id: "T-1045", userId: 1, date: "2026-10-09", time: "17:01", label: "Derby Algérois", amount: 2850, type: "gain", status: "En cours" },
    { id: "T-1044", userId: 1, date: "2026-10-07", time: "16:33", label: "Collection Atlas", amount: 8755, type: "gain", status: "Validé" },
    { id: "T-1043", userId: 1, date: "2026-10-05", time: "13:04", label: "Les Sketchs du Bled", amount: 18755, type: "gain", status: "Validé" },
    { id: "T-1042", userId: 1, date: "2026-10-01", time: "10:20", label: "Retrait vers CCP", amount: -25000, type: "retrait", status: "Validé" },
    { id: "T-1041", userId: 1, date: "2026-09-29", time: "19:45", label: "Derby Algérois", amount: 4155, type: "gain", status: "Validé" },
    { id: "T-1040", userId: 1, date: "2026-09-26", time: "11:12", label: "Kahwa du matin", amount: 1078, type: "gain", status: "Validé" },
    { id: "T-1039", userId: 2, date: "2026-10-10", time: "09:30", label: "Retrait vers BaridiMob", amount: -30000, type: "retrait", status: "En cours" },
    { id: "T-1038", userId: 4, date: "2026-10-09", time: "21:05", label: "Retrait vers CCP", amount: -8000, type: "retrait", status: "En cours" },
    { id: "T-1037", userId: 2, date: "2026-10-06", time: "14:00", label: "Kahwa du matin", amount: 2068, type: "gain", status: "Validé" },
  ],

  notifications: [
    { id: 20, userId: 50, icon: "🎬", text: "12 nouveaux clips reçus sur « Derby Algérois » cette semaine.", time: "Il y a 1 h", unread: true },
    { id: 21, userId: 51, icon: "⏳", text: "Votre campagne « Spécial Soirées d'Été » est en cours de vérification.", time: "Hier", unread: true },
    { id: 1, userId: 1, icon: "✅", text: "Votre clip « Le taxi clandestin » a été validé.", time: "Il y a 2 h", unread: true },
    { id: 2, userId: 1, icon: "🎯", text: "Nouvelle campagne : Tournoi Djurdjura Gaming.", time: "Il y a 5 h", unread: true },
    { id: 3, userId: 1, icon: "💸", text: "8 755 DA ajoutés à votre portefeuille.", time: "Hier", unread: true },
    { id: 4, userId: 1, icon: "⚠️", text: "Clip « Garantita brûlante » refusé : lieu non visible.", time: "Il y a 3 j", unread: false },
  ],

  activity: [
    { icon: "🎯", text: "Hoggar Boissons a soumis la campagne « Spécial Soirées d'Été ».", time: "Hier, 18:20" },
    { icon: "💸", text: "Amira Khelifi a demandé un retrait de 30 000 DA.", time: "Hier, 09:30" },
    { icon: "👤", text: "Sofiane Zerrouki s'est inscrit.", time: "30 sept." },
    { icon: "⛔", text: "Karim Haddad a été suspendu (vues non conformes).", time: "28 sept." },
  ],
};

// Seuil minimum (gain avant examen du clip) et plafond de gains par clip, en DA.
// Par défaut : 2 000 vues pour le seuil, 200 000 vues pour le plafond.
const PAYOUT_PRESETS = { rire: { maxPayout: 6000 } };
db.campaigns.forEach((c) => Object.assign(c, { minPayout: c.rate * 2, maxPayout: c.rate * 200 }, PAYOUT_PRESETS[c.id]));

const views30 = [3.1, 3.4, 2.9, 4.2, 5.1, 4.8, 5.6, 6.2, 5.9, 6.8, 7.4, 7.1, 6.5, 7.9, 8.6, 8.2, 9.4, 10.1, 9.7, 11.2, 12.4, 11.8, 12.9, 14.1, 13.6, 15.2, 16.8, 15.9, 17.4, 18.6];
const income12 = [8, 9, 12, 18, 24, 27, 27, 26, 29, 33, 35, 33, 27];
const signups30 = [12, 15, 11, 18, 22, 19, 25, 31, 28, 26, 34, 38, 33, 41, 45, 39, 48, 52, 47, 55, 61, 58, 64, 70, 66, 73, 79, 75, 84, 91];
