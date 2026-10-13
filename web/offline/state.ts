// Données renvoyées par GET /api/state : même forme que lib/server/services/state.ts.
import { getSettings, newestFirst, type Store, type UserRow } from "./db";
import { balances } from "./services";

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const time = (ms: number) => new Date(ms).toISOString().slice(11, 16);

function publicUser(u: UserRow) {
  return { id: u.id, role: u.role, name: u.name, country: u.country, status: u.status, level: u.level, joined: day(u.createdAt), handle: u.handles.tiktok ?? u.handles.instagram ?? u.handles.youtube ?? "" };
}

function fullUser(u: UserRow) {
  return { ...publicUser(u), email: u.email, contact: u.contact, credit: u.credit, bio: u.bio, handles: u.handles, payoutMethod: u.payoutMethod, payoutAccount: u.payoutAccount, verified: true };
}

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
  const isAdmin = user.role === "admin", isAgency = user.role === "agence";

  const campaignRows = newestFirst(db.campaigns.filter((c) => (isAdmin ? true : isAgency ? c.ownerId === user.id : ["Active", "En pause", "Terminée"].includes(c.status))));
  const campaignIds = new Set(campaignRows.map((c) => c.id));
  const clippersOf = new Map<string, number>();
  for (const m of db.members) if (m.joined && campaignIds.has(m.campaignId)) clippersOf.set(m.campaignId, (clippersOf.get(m.campaignId) ?? 0) + 1);

  const pubRows = newestFirst(db.publications.filter((p) => (isAdmin ? true : isAgency ? campaignIds.has(p.campaignId) : p.userId === user.id)));

  // Utilisateurs visibles : tous pour l'admin, les auteurs des clips pour une agence, soi-même pour un clipper.
  const authors = new Set(pubRows.map((p) => p.userId));
  const userRows = isAdmin ? newestFirst(db.users) : db.users.filter((u) => u.id === user.id || authors.has(u.id));

  const txRows = newestFirst(db.transactions.filter((t) => (isAdmin ? t.type !== "gain" : t.userId === user.id))).slice(0, isAdmin ? 500 : 200);
  const notifRows = newestFirst(db.notifications.filter((n) => n.userId === user.id)).slice(0, 30);
  const activityRows = isAdmin ? newestFirst(db.activity).slice(0, 30) : [];

  const mine = user.role === "clipper" ? db.members.filter((m) => m.userId === user.id) : [];
  const since = Date.now() - 30 * 86_400_000;

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

  return {
    me: { ...fullUser(user), favorites: mine.filter((m) => m.favorite).map((m) => m.campaignId), joinedCampaigns: mine.filter((m) => m.joined).map((m) => m.campaignId), ...(balanceOf.get(user.id) ?? {}) },
    settings: { maintenance: settings.maintenance, signupsOpen: settings.signupsOpen, announcement: settings.announcement, minWithdraw: settings.minWithdraw, commissionRate: settings.commissionRate, minBudget: settings.minBudget, holdDays: settings.holdDays, earningDays: settings.earningDays, instantFeePercent: settings.instantFeePercent, instantMinFee: settings.instantMinFee },
    users: userRows.map((u) => ({ ...(isAdmin ? fullUser(u) : u.id === user.id ? fullUser(u) : publicUser(u)), ...(balanceOf.get(u.id) ?? {}) })),
    campaigns: campaignRows.map((c) => ({
      id: c.id, ownerId: c.ownerId, title: c.title, brand: c.brand, category: c.category, rate: c.rate, budget: c.budget, spent: c.spent,
      minPayout: c.minPayout, maxPayout: c.maxPayout, commissionRate: c.commissionRate, reserved: c.reserved, status: c.status, top: c.top,
      emoji: c.emoji, gradient: c.gradient, platforms: c.platforms, rules: c.rules, createdAt: day(c.createdAt), clippers: clippersOf.get(c.id) ?? 0,
    })),
    publications: pubRows.map((p) => ({ id: p.id, userId: p.userId, campaign: p.campaignId, title: p.title, platform: p.platform, url: p.url, views: p.views, status: p.status, reason: p.reason, paid: p.paid, date: day(p.createdAt) })),
    transactions: txRows.map((t) => ({ id: t.id, ref: t.ref, userId: t.userId, type: t.type, label: t.label, amount: t.amount, fee: t.fee, status: t.status, method: t.method, date: day(t.createdAt), time: time(t.createdAt), availableAt: t.availableAt === null ? null : new Date(t.availableAt).toISOString() })),
    notifications: notifRows.map((n) => ({ id: n.id, icon: n.icon, text: n.text, unread: !n.read, at: new Date(n.createdAt).toISOString() })),
    activity: activityRows.map((a) => ({ icon: a.icon, text: a.text, at: new Date(a.createdAt).toISOString() })),
    series,
  };
}

/** Données publiques de la page d'accueil (aucune connexion requise). */
export function publicState(db: Store) {
  const settings = getSettings(db);
  const campaigns = newestFirst(db.campaigns.filter((c) => c.status === "Active"))
    .sort((a, b) => Number(b.top) - Number(a.top))
    .slice(0, 12);
  return {
    settings: { maintenance: settings.maintenance, signupsOpen: settings.signupsOpen, announcement: settings.announcement },
    campaigns: campaigns.map((c) => ({ id: c.id, title: c.title, brand: c.brand, category: c.category, rate: c.rate, budget: c.budget, spent: c.spent, minPayout: c.minPayout, maxPayout: c.maxPayout, emoji: c.emoji, gradient: c.gradient, top: c.top, platforms: c.platforms, createdAt: day(c.createdAt) })),
  };
}
