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
  settings: { maintenance: false, signupsOpen: true, announcement: "", minWithdraw: 2000, commissionRate: 15, minBudget: 50000, holdDays: 3, earningDays: 7, instantFeePercent: 2, instantMinFee: 100, weeklyPrizes: [10000, 7000, 5000, 4000, 3000, 2500, 2000, 1500, 1000, 1000], referralBonus: 1000 },
  users: [], campaigns: [], agencies: [], publications: [], appeals: [], threads: [], transactions: [], notifications: [], activity: [],
  series: { daily: [], label: "" },
  // Connexions Google, Apple, Discord proposées (configurées sur le serveur ; toutes, simulées, dans la version autonome).
  oauth: [],
  // Relevé automatique des vues (admin seulement) : { everyHours, lastRunAt, summary, simulated }.
  tracking: null,
  // Classement hebdomadaire (clippers et admin) : { week, number, start, end, prizes, ranked, top, me?, last, history? }.
  leaderboard: null,
  // Parrainage (clippers) : { code, referees: [{ name, joined, firstWithdrawal, bonus }], stats: { referees, firstWithdrawals, bonus } }.
  referral: null,
  // Académie (clippers : leçons publiées ; admin : toutes, avec le corps brut) : [{ id, category, emoji, minutes, videoUrl, title, summary, html, position, published, … }].
  lessons: [],
});
let db = emptyDb();

// Requête vers l'API : le serveur (fetch), ou l'API simulée de la version autonome (fichier HTML unique, web/offline/server.ts).
// Une réponse en erreur lève une Error avec le message du serveur (en français) et son statut.
async function apiFetch(method, path, body) {
  let res;
  try {
    const init = { method, credentials: "same-origin", headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined };
    const offline = window.__CLIPBOOST_OFFLINE__;
    res = await (offline ? offline.fetch(path, init) : fetch(path, init));
  } catch (e) {
    // Erreur née dans le navigateur (aucune réponse) : déjà dans la langue choisie (tServer la laisse telle quelle).
    throw new Error(t("Connexion au serveur impossible. Vérifiez votre connexion internet."));
  }
  if (!res.ok) {
    let data = {};
    try { data = await res.json(); } catch (e) {}
    // Message du serveur gardé en français (comparaisons, motifs de tServer) : traduit là où il s'affiche.
    const err = new Error(data.error || t("Une erreur est survenue, réessayez."));
    err.status = res.status;
    throw err;
  }
  return res;
}

async function api(method, path, body) {
  const res = await apiFetch(method, path, body);
  let data = {};
  try { data = await res.json(); } catch (e) {}
  return data;
}

/**
 * Téléchargement d'un fichier de l'API (facture ou reçu PDF, export CSV), en ligne comme dans le fichier HTML ouvert
 * depuis le disque : la réponse est lue en Blob puis enregistrée par un lien <a download> (adresse blob:, sans serveur).
 * Nom du fichier : celui de l'en-tête Content-Disposition, sinon `fallback`. Une erreur est annoncée par un toast.
 */
let downloading = false;
async function downloadFile(path, fallback) {
  if (downloading) return false;
  downloading = true;
  try {
    const res = await apiFetch("GET", path);
    const blob = await res.blob();
    const name = (/filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "") || [])[1] || fallback;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Le navigateur a déjà lu le fichier : l'adresse blob: est libérée un peu plus tard.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  } catch (e) {
    if (e.status === 401) { await refresh().catch(() => {}); state.modal = null; navigate("#/connexion"); }
    toast(tServer(e.message), "danger");
    return false;
  } finally {
    downloading = false;
  }
}

/** Facture (recharge) ou reçu (retrait) PDF d'une transaction validée. */
const downloadDocument = (x) => downloadFile(`/api/transactions/${encodeURIComponent(x.id)}/document`, `${x.document || x.ref}.pdf`);

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
  // Compte ouvert (inscription faite, ou retour de Google, Apple, Discord) : le code de parrainage gardé ne sert plus.
  authForgetReferral();
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
