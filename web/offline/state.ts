// Données renvoyées par GET /api/state : même forme que lib/server/services/state.ts.
import { getSettings, newestFirst, type SocialRow, type Store, type UserRow } from "./db";
import { balances } from "./services";
import { inferLink, type LinkContext } from "../../lib/server/links";
import { OAUTH_PROVIDERS } from "../../lib/server/validation";
import { PLATFORMS } from "../../lib/server/gradients";
import { dailyGains, isTeamCampaign, messageThreads, RISK_WINDOW_DAYS, utcDay } from "../../lib/server/rules";
import { leaderboardState } from "./leaderboard";
import { lastJobRun, simulatedPlatforms, TRACK_EVERY_HOURS, VIEWS_JOB } from "./tracking";

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const time = (ms: number) => new Date(ms).toISOString().slice(11, 16);

/** verified : le badge bleu de vérification (agences). */
function publicUser(u: UserRow) {
  return {
    id: u.id, role: u.role, name: u.name, avatar: u.avatar, verified: u.verification === "verified", country: u.country, status: u.status, level: u.level,
    joined: day(u.createdAt), handle: u.handles.tiktok || u.handles.instagram || u.handles.youtube || u.handles.facebook || "",
  };
}

/** Profil public d'une agence (organisatrice de campagnes) : aucune donnée privée (email, contact, crédit). */
function publicAgency(u: UserRow) {
  return { id: u.id, name: u.name, avatar: u.avatar, cover: u.cover, verified: u.verification === "verified", country: u.country, bio: u.bio, joined: day(u.createdAt) };
}

/** emailVerified : adresse confirmée (code à l'inscription, ou fournisseur Google, Apple, Discord). */
function fullUser(u: UserRow) {
  return {
    ...publicUser(u), email: u.email, contact: u.contact, credit: u.credit, bio: u.bio, handles: u.handles, payoutMethod: u.payoutMethod, payoutAccount: u.payoutAccount,
    cover: u.cover, verification: u.verification, verificationNote: u.verificationNote, locale: u.locale, emailVerified: true,
  };
}

/** Compte social tel que l'app le reçoit (socialView, lib/server/services/social.ts). */
const socialView = (a: SocialRow) => ({
  id: a.id, platform: a.platform, handle: a.handle, code: a.code, status: a.status,
  verifiedAt: a.verifiedAt === null ? null : new Date(a.verifiedAt).toISOString(), checkedAt: a.checkedAt === null ? null : new Date(a.checkedAt).toISOString(),
});

/** Série quotidienne sur 30 jours (jours UTC, comme le serveur). */
function daily30(rows: { at: number; v: number }[]) {
  const map = new Map<string, number>();
  for (const r of rows) map.set(day(r.at), (map.get(day(r.at)) ?? 0) + r.v);
  return Array.from({ length: 30 }, (_, i) => map.get(day(Date.now() - (29 - i) * 86_400_000)) ?? 0);
}

/**
 * Tout ce que l'interface affiche pour l'utilisateur connecté, filtré selon son rôle.
 * Un clipper ne voit que ses données, une agence ses campagnes et les clips reçus, l'admin tout.
 */
export function stateFor(db: Store, user: UserRow) {
  const settings = getSettings(db);
  const isAdmin = user.role === "admin", isAgency = user.role === "agence", isClipper = user.role === "clipper";

  const campaignRows = newestFirst(db.campaigns.filter((c) => (isAdmin ? true : isAgency ? c.ownerId === user.id : ["Active", "En pause", "Terminée"].includes(c.status))));
  const campaignIds = new Set(campaignRows.map((c) => c.id));
  const clippersOf = new Map<string, number>();
  for (const m of db.members) if (m.joined && campaignIds.has(m.campaignId)) clippersOf.set(m.campaignId, (clippersOf.get(m.campaignId) ?? 0) + 1);

  const pubRows = newestFirst(db.publications.filter((p) => (isAdmin ? true : isAgency ? campaignIds.has(p.campaignId) : p.userId === user.id)));

  // Conversations de campagne : les siennes (clipper, campagnes visibles), celles de ses campagnes (agence), celles des
  // campagnes de ClipBoost (admin).
  const roleOf = new Map(db.users.map((u) => [u.id, u.role]));
  const threadCampaigns = new Set(isAdmin ? campaignRows.filter((c) => isTeamCampaign(c.ownerId, c.ownerId ? roleOf.get(c.ownerId) : null)).map((c) => c.id) : campaignIds);
  const msgRows = db.messages.filter((m) => threadCampaigns.has(m.campaignId) && (!isClipper || m.clipperId === user.id));

  // Utilisateurs visibles : tous pour l'admin, les auteurs des clips et des conversations pour une agence, soi-même pour un clipper.
  const authors = new Set([...pubRows.map((p) => p.userId), ...(isAgency ? msgRows.map((m) => m.clipperId) : [])]);
  const userRows = isAdmin ? newestFirst(db.users) : db.users.filter((u) => u.id === user.id || authors.has(u.id));

  // Clipper : les agences qui organisent les campagnes visibles (page « Agences » de l'espace Clipper).
  const ownerIds = new Set(isClipper ? campaignRows.flatMap((c) => (c.ownerId ? [c.ownerId] : [])) : []);
  const agencyRows = db.users.filter((u) => ownerIds.has(u.id));

  const txRows = newestFirst(db.transactions.filter((t) => (isAdmin ? t.type !== "gain" : t.userId === user.id))).slice(0, isAdmin ? 500 : 200);
  // Facture (recharge) ou reçu (retrait) des transactions validées : son numéro, pour le bouton de téléchargement.
  const docOf = new Map(db.documents.map((d) => [d.transactionId, d.number]));
  const notifRows = newestFirst(db.notifications.filter((n) => n.userId === user.id)).slice(0, 30);
  const activityRows = isAdmin ? newestFirst(db.activity).slice(0, 30) : [];

  const mine = isClipper ? db.members.filter((m) => m.userId === user.id) : [];
  // Comptes sociaux : les siens pour un clipper, ceux de chaque clipper pour l'admin ; dans l'ordre des plateformes.
  const socialOf = (id: string) => db.social.filter((a) => a.userId === id).sort((a, b) => PLATFORMS.indexOf(a.platform) - PLATFORMS.indexOf(b.platform)).map(socialView);
  const since = Date.now() - 30 * 86_400_000;

  // Admin : historique jour par jour des clips (RISK_WINDOW_DAYS derniers jours, avec le gain de chaque jour) et dernier
  // relevé des vues (même forme que le serveur).
  const snapSince = Date.now() - 45 * 86_400_000, windowStart = utcDay(Date.now() - (RISK_WINDOW_DAYS - 1) * 86_400_000);
  const snapsOf = new Map<string, Store["snapshots"]>();
  if (isAdmin) for (const x of db.snapshots) if (x.day >= utcDay(snapSince)) snapsOf.set(x.publicationId, [...(snapsOf.get(x.publicationId) ?? []), x]);
  const historyOf = (p: (typeof pubRows)[number]) => dailyGains(snapsOf.get(p.id) ?? [], p.createdAt >= snapSince ? utcDay(p.createdAt) : undefined)
    .filter((h) => h.day >= windowStart).map(({ day, views, likes, gain }) => ({ day, views, likes, gain }));
  const viewsRun = isAdmin ? lastJobRun(db, VIEWS_JOB) : null;
  // Recours contre un clip refusé : les siens pour un clipper, tous pour l'admin (avec l'auteur de la décision) ; aucun pour une agence.
  const appealRows = newestFirst(db.appeals.filter((a) => isAdmin || (isClipper && a.userId === user.id)));

  // Séries des graphiques.
  let series: { daily: number[]; label: string };
  if (isAdmin) {
    series = { daily: daily30(db.users.filter((u) => u.role !== "admin" && u.createdAt >= since).map((u) => ({ at: u.createdAt, v: 1 }))), label: "Inscriptions par jour" };
  } else {
    const pubIds = new Set(pubRows.map((p) => p.id));
    const gains = db.transactions.filter((t) => t.type === "gain" && t.createdAt >= since && (isAgency ? t.publicationId !== null && pubIds.has(t.publicationId) : t.userId === user.id));
    series = { daily: daily30(gains.map((t) => ({ at: t.createdAt, v: t.amount }))), label: isAgency ? "Budget consommé par jour (DA)" : "Gains par jour (DA)" };
  }

  // Soldes : pour chaque clipper visible par l'admin, et pour soi-même.
  const balanceTargets = isAdmin ? userRows.filter((u) => u.role === "clipper") : user.role === "clipper" ? [user] : [];
  const balanceOf = new Map(balanceTargets.map((u) => [u.id, balances(db, u.id)]));

  // Notifications antérieures aux liens (ancienne copie du navigateur) : lien déduit du texte (voir inferLink).
  const linkCtx: LinkContext = { campaigns: campaignRows, publications: pubRows, transactions: txRows };

  // Comptes Google, Apple, Discord reliés ; hasPassword faux pour un compte créé avec l'un d'eux, tant qu'il n'a pas défini de mot de passe.
  const linked = new Set(db.oauth.filter((a) => a.userId === user.id).map((a) => a.provider));

  return {
    me: {
      ...fullUser(user), hasPassword: user.passwordHash !== "", providers: OAUTH_PROVIDERS.filter((p) => linked.has(p)),
      favorites: mine.filter((m) => m.favorite).map((m) => m.campaignId), joinedCampaigns: mine.filter((m) => m.joined).map((m) => m.campaignId), ...(balanceOf.get(user.id) ?? {}),
      ...(isClipper ? { socialAccounts: socialOf(user.id) } : {}),
    },
    settings: { maintenance: settings.maintenance, signupsOpen: settings.signupsOpen, announcement: settings.announcement, minWithdraw: settings.minWithdraw, commissionRate: settings.commissionRate, minBudget: settings.minBudget, holdDays: settings.holdDays, earningDays: settings.earningDays, instantFeePercent: settings.instantFeePercent, instantMinFee: settings.instantMinFee, weeklyPrizes: settings.weeklyPrizes },
    users: userRows.map((u) => ({
      ...(isAdmin ? fullUser(u) : u.id === user.id ? fullUser(u) : publicUser(u)), ...(balanceOf.get(u.id) ?? {}),
      ...(u.role === "clipper" && (isAdmin || u.id === user.id) ? { socialAccounts: socialOf(u.id) } : {}),
    })),
    campaigns: campaignRows.map((c) => ({
      id: c.id, ownerId: c.ownerId, title: c.title, brand: c.brand, category: c.category, rate: c.rate, budget: c.budget, spent: c.spent,
      minPayout: c.minPayout, maxPayout: c.maxPayout, commissionRate: c.commissionRate, reserved: c.reserved, status: c.status, top: c.top,
      emoji: c.emoji, gradient: c.gradient, platforms: c.platforms, rules: c.rules, image: c.image, reviewNote: c.reviewNote,
      createdAt: day(c.createdAt), updatedAt: new Date(c.updatedAt).toISOString(), clippers: clippersOf.get(c.id) ?? 0,
    })),
    agencies: agencyRows.map(publicAgency).sort((a, b) => a.name.localeCompare(b.name, "fr") || a.id.localeCompare(b.id)),
    // Score de risque, signaux et historique : pour l'admin seulement.
    publications: pubRows.map((p) => ({
      id: p.id, userId: p.userId, campaign: p.campaignId, title: p.title, platform: p.platform, url: p.url, batch: p.batch, views: p.views, likes: p.likes,
      checkedAt: p.checkedAt === null ? null : new Date(p.checkedAt).toISOString(), status: p.status, reason: p.reason, paid: p.paid, date: day(p.createdAt),
      ...(isAdmin ? { riskScore: p.riskScore, riskFlags: p.riskFlags, history: historyOf(p) } : {}),
    })),
    appeals: appealRows.map((a) => ({
      id: a.id, publicationId: a.publicationId, userId: a.userId, message: a.message, proof: a.proof, status: a.status, decisionNote: a.decisionNote,
      decidedAt: a.decidedAt === null ? null : new Date(a.decidedAt).toISOString(), createdAt: new Date(a.createdAt).toISOString(), ...(isAdmin ? { decidedBy: a.decidedBy } : {}),
    })),
    threads: messageThreads(msgRows, isClipper),
    transactions: txRows.map((t) => ({ id: t.id, ref: t.ref, userId: t.userId, type: t.type, label: t.label, amount: t.amount, fee: t.fee, status: t.status, method: t.method, date: day(t.createdAt), time: time(t.createdAt), availableAt: t.availableAt === null ? null : new Date(t.availableAt).toISOString(),
      provider: t.provider, ...(isAdmin ? { providerRef: t.providerRef } : {}), document: docOf.get(t.id) ?? null })),
    notifications: notifRows.map((n) => ({ id: n.id, icon: n.icon, text: n.text, link: n.link ?? inferLink(user.role, n.text, linkCtx), unread: !n.read, at: new Date(n.createdAt).toISOString() })),
    activity: activityRows.map((a) => ({ icon: a.icon, text: a.text, at: new Date(a.createdAt).toISOString() })),
    series,
    // Paiement en ligne des recharges : toujours simulé hors ligne (page de paiement simulée de l'app).
    ...(isAdmin || isAgency ? { payments: { simulated: true } } : {}),
    // Classement hebdomadaire (clippers et admin) : semaine en cours en direct, dernière semaine clôturée ; historique pour l'admin.
    ...(isClipper || isAdmin ? { leaderboard: leaderboardState(db, user, settings.weeklyPrizes) } : {}),
    // Relevé des vues (admin) : dernière exécution, son bilan, plateformes en mode simulé (toutes, hors ligne).
    ...(isAdmin ? { tracking: { everyHours: TRACK_EVERY_HOURS, lastRunAt: viewsRun ? new Date(viewsRun.lastRunAt).toISOString() : null, summary: viewsRun?.summary ?? null, simulated: simulatedPlatforms() } } : {}),
  };
}

/** Données publiques de la page d'accueil et des écrans de connexion (aucune connexion requise). */
export function publicState(db: Store) {
  const settings = getSettings(db);
  const campaigns = newestFirst(db.campaigns.filter((c) => c.status === "Active"))
    .sort((a, b) => Number(b.top) - Number(a.top))
    .slice(0, 12);
  return {
    settings: { maintenance: settings.maintenance, signupsOpen: settings.signupsOpen, announcement: settings.announcement },
    campaigns: campaigns.map((c) => ({ id: c.id, title: c.title, brand: c.brand, category: c.category, rate: c.rate, budget: c.budget, spent: c.spent, minPayout: c.minPayout, maxPayout: c.maxPayout, emoji: c.emoji, gradient: c.gradient, image: c.image, top: c.top, platforms: c.platforms, createdAt: day(c.createdAt) })),
    // Hors ligne, les trois connexions sont proposées (simulées, voir POST /api/auth/oauth/demo).
    oauth: [...OAUTH_PROVIDERS],
  };
}
