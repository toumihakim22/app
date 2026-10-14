// Données de l'utilisateur connecté, chargées depuis l'API (voir refresh()).

// Mêmes listes que lib/server/gradients.ts. « Autre » : l'agence précise sa catégorie (texte libre enregistré tel quel).
const CATEGORIES = ["Sport", "Food", "Tech", "Mode", "Beauté", "Musique", "Humour", "Gaming", "Cinéma", "Voyage",
  "Automobile", "Éducation", "Santé", "Finance", "Immobilier", "Lifestyle", "Événementiel", "Autre"];
const PLATFORMS = ["TikTok", "Instagram", "YouTube", "Facebook"];
// Le lien d'un clip doit pointer vers la plateforme déclarée (https), comme côté serveur.
const PLATFORM_HOSTS = { TikTok: /(^|\.)tiktok\.com$/, Instagram: /(^|\.)instagram\.com$/, YouTube: /(^|\.)(youtube\.com|youtu\.be)$/, Facebook: /(^|\.)(facebook\.com|fb\.watch|fb\.com)$/ };
const PLATFORM_PLACEHOLDER = { TikTok: "https://www.tiktok.com/@…", Instagram: "https://www.instagram.com/reel/…", YouTube: "https://youtube.com/shorts/…", Facebook: "https://www.facebook.com/reel/…" };
const COUNTRIES = ["Algérie", "Maroc", "Tunisie", "Libye", "Mauritanie", "Égypte", "France", "Belgique", "Suisse", "Canada", "Sénégal", "Côte d'Ivoire", "Arabie saoudite", "Émirats arabes unis", "Qatar", "Autre"];
const PAYOUT_METHODS = ["BaridiMob", "CCP", "RIB bancaire"];

const emptyDb = () => ({
  me: null,
  settings: { maintenance: false, signupsOpen: true, announcement: "", minWithdraw: 2000, commissionRate: 15, minBudget: 50000, holdDays: 3, earningDays: 7, instantFeePercent: 2, instantMinFee: 100 },
  users: [], campaigns: [], agencies: [], publications: [], transactions: [], notifications: [], activity: [],
  series: { daily: [], label: "" },
  // Connexions Google, Apple, Discord proposées (configurées sur le serveur ; toutes, simulées, dans la version autonome).
  oauth: [],
});
let db = emptyDb();

async function api(method, path, body) {
  let res;
  try {
    const init = { method, credentials: "same-origin", headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined };
    // Version autonome (fichier HTML unique) : l'API tourne dans le navigateur, voir web/offline/server.ts.
    const offline = window.__CLIPBOOST_OFFLINE__;
    res = await (offline ? offline.fetch(path, init) : fetch(path, init));
  } catch (e) {
    throw new Error("Connexion au serveur impossible. Vérifiez votre connexion internet.");
  }
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    const err = new Error(data.error || "Une erreur est survenue, réessayez.");
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Recharge toutes les données visibles par l'utilisateur connecté. */
async function refresh() {
  const s = await api("GET", "/api/state");
  if (!s.user) {
    db = emptyDb();
    Object.assign(db.settings, s.public.settings);
    db.oauth = s.public.oauth || [];
    state.session = null;
    return;
  }
  s.me.favorites = new Set(s.me.favorites);
  s.me.joinedCampaigns = new Set(s.me.joinedCampaigns);
  s.users = s.users.map((u) => (u.id === s.me.id ? s.me : u));
  if (!s.users.some((u) => u.id === s.me.id)) s.users.push(s.me);
  s.oauth = s.oauth || [];
  db = s;
  state.session = s.me.id;
  adoptAccountLang(s.me.locale);
}

/**
 * Exécute une action sur le serveur, recharge les données et réaffiche la page.
 * `success` : message affiché en cas de réussite (texte ou fonction recevant la réponse).
 */
let busy = false;
async function act(method, path, body, success, after) {
  if (busy) return null;
  busy = true;
  try {
    const res = await api(method, path, body);
    await refresh();
    if (after) after(res);
    render();
    if (success) toast(typeof success === "function" ? success(res) : success);
    return res;
  } catch (e) {
    // Session expirée : retour à la connexion (onRoute() referme modale, menus et tiroir).
    if (e.status === 401) { await refresh().catch(() => {}); state.modal = null; navigate("#/connexion"); }
    // Message du serveur (français) traduit à l'affichage dans la langue choisie.
    toast(tServer(e.message), "danger");
    return null;
  } finally {
    busy = false;
  }
}
