import { and, desc, eq, gte, inArray, ne, or, sql } from "drizzle-orm";
import { getDb, schema } from "../db";
import type { User } from "../auth";
import { getSettings } from "../settings";
import { balances } from "./money";
import { inferLink, type LinkContext } from "../links";
import { configuredProviders } from "../oauth";
import { chargilyConfigured } from "../chargily";
import { OAUTH_PROVIDERS } from "../validation";
import { PLATFORMS } from "../gradients";
import { documentNumbers } from "./documents";
import { socialView } from "./social";
import { dailyGains, RISK_WINDOW_DAYS, utcDay } from "../rules";
import { simulatedPlatforms, TRACK_EVERY_HOURS, VIEWS_JOB } from "./tracking";

const day = (d: Date) => d.toISOString().slice(0, 10);
const time = (d: Date) => d.toISOString().slice(11, 16);

type UserRow = typeof schema.users.$inferSelect;

/** Ce que tout utilisateur visible peut voir d'un autre : photo et badge bleu (agence vérifiée) compris. */
function publicUser(u: UserRow) {
  return {
    id: u.id, role: u.role, name: u.name, country: u.country, status: u.status, level: u.level, joined: day(u.createdAt),
    handle: u.handles.tiktok || u.handles.instagram || u.handles.youtube || u.handles.facebook || "", avatar: u.avatar, verified: u.verification === "verified",
  };
}

/** Profil public d'une agence (organisatrice de campagnes) : aucune donnée privée (email, contact, crédit). */
function publicAgency(u: UserRow) {
  return { id: u.id, name: u.name, country: u.country, bio: u.bio, joined: day(u.createdAt), avatar: u.avatar, cover: u.cover, verified: u.verification === "verified" };
}

/** Profil complet (soi-même ; tous les comptes pour l'admin). emailVerified : l'adresse a été vérifiée à l'inscription (code ou fournisseur). */
function fullUser(u: UserRow) {
  return {
    ...publicUser(u), email: u.email, contact: u.contact, credit: u.credit, bio: u.bio, handles: u.handles, payoutMethod: u.payoutMethod, payoutAccount: u.payoutAccount,
    cover: u.cover, verification: u.verification, verificationNote: u.verificationNote, locale: u.locale, emailVerified: true,
  };
}

/** Série quotidienne sur 30 jours à partir de lignes { d: 'YYYY-MM-DD', v }. */
function daily30(rows: { d: string; v: number }[]) {
  const map = new Map(rows.map((r) => [r.d, Number(r.v)]));
  return Array.from({ length: 30 }, (_, i) => map.get(day(new Date(Date.now() - (29 - i) * 86_400_000))) ?? 0);
}

/**
 * Tout ce que l'interface affiche pour l'utilisateur connecté, filtré selon son rôle.
 * Un clipper ne voit que ses données, une agence ses campagnes et les clips reçus, l'admin tout.
 */
export async function stateFor(user: User) {
  const db = await getDb();
  const settings = await getSettings();
  const isAdmin = user.role === "admin", isAgency = user.role === "agence", isClipper = user.role === "clipper";
  const C = schema.campaigns, P = schema.publications, T = schema.transactions, M = schema.campaignMembers;

  const campaignRows = await db.select().from(C).where(
    isAdmin ? undefined : isAgency ? eq(C.ownerId, user.id) : inArray(C.status, ["Active", "En pause", "Terminée"]),
  ).orderBy(desc(C.createdAt));
  const campaignIds = campaignRows.map((c) => c.id);

  const memberCounts = campaignIds.length
    ? await db.select({ id: M.campaignId, n: sql<number>`count(*)` }).from(M).where(and(inArray(M.campaignId, campaignIds), eq(M.joined, true))).groupBy(M.campaignId)
    : [];
  const clippersOf = new Map(memberCounts.map((r) => [r.id, Number(r.n)]));

  const pubRows = await db.select().from(P).where(
    isAdmin ? undefined : isAgency ? (campaignIds.length ? inArray(P.campaignId, campaignIds) : sql`false`) : eq(P.userId, user.id),
  ).orderBy(desc(P.createdAt));

  // Utilisateurs visibles : tous pour l'admin, les auteurs des clips pour une agence, soi-même pour un clipper.
  const userRows = isAdmin
    ? await db.select().from(schema.users).orderBy(desc(schema.users.createdAt))
    : await db.select().from(schema.users).where(or(eq(schema.users.id, user.id), pubRows.length ? inArray(schema.users.id, [...new Set(pubRows.map((p) => p.userId))]) : sql`false`));

  // Clipper : les agences qui organisent les campagnes visibles (page « Agences » de l'espace Clipper).
  const ownerIds = isClipper ? [...new Set(campaignRows.flatMap((c) => (c.ownerId ? [c.ownerId] : [])))] : [];
  const agencyRows = ownerIds.length ? await db.select().from(schema.users).where(inArray(schema.users.id, ownerIds)) : [];

  const txRows = await db.select().from(T).where(isAdmin ? ne(T.type, "gain") : eq(T.userId, user.id)).orderBy(desc(T.createdAt)).limit(isAdmin ? 500 : 200);
  // Facture (recharge) ou reçu (retrait) des transactions validées : son numéro, pour le bouton de téléchargement.
  const docOf = await documentNumbers(txRows.filter((t) => t.status === "Validé" && t.type !== "gain").map((t) => t.id));
  const notifRows = await db.select().from(schema.notifications).where(eq(schema.notifications.userId, user.id)).orderBy(desc(schema.notifications.createdAt)).limit(30);
  const activityRows = isAdmin ? await db.select().from(schema.activity).orderBy(desc(schema.activity.createdAt)).limit(30) : [];

  const mine = isClipper ? await db.select().from(M).where(eq(M.userId, user.id)) : [];
  // Comptes sociaux : les siens pour un clipper, ceux de chaque clipper pour l'admin ; dans l'ordre des plateformes.
  const SA = schema.socialAccounts;
  const socialRows = isAdmin ? await db.select().from(SA) : isClipper ? await db.select().from(SA).where(eq(SA.userId, user.id)) : [];
  const socialOf = (id: string) => socialRows.filter((a) => a.userId === id).sort((a, b) => PLATFORMS.indexOf(a.platform) - PLATFORMS.indexOf(b.platform)).map(socialView);
  // Comptes Google, Apple ou Discord reliés (Paramètres), dans l'ordre des boutons ; hasPassword : faux pour un compte créé par l'un d'eux sans mot de passe.
  const providers = (await db.select({ provider: schema.oauthAccounts.provider }).from(schema.oauthAccounts).where(eq(schema.oauthAccounts.userId, user.id))).map((r) => r.provider);
  const since = new Date(Date.now() - 30 * 86_400_000);

  // Admin : historique jour par jour des clips (RISK_WINDOW_DAYS derniers jours, avec le gain de chaque jour) et dernier
  // relevé automatique. Les relevés plus anciens servent au gain du premier jour de la fenêtre.
  const V = schema.viewSnapshots, snapSince = Date.now() - 45 * 86_400_000;
  const snapRows = isAdmin ? await db.select({ id: V.publicationId, day: V.day, views: V.views, likes: V.likes }).from(V).where(gte(V.day, utcDay(snapSince))).orderBy(V.day) : [];
  const snapsOf = new Map<string, typeof snapRows>();
  for (const r of snapRows) snapsOf.set(r.id, [...(snapsOf.get(r.id) ?? []), r]);
  const windowStart = utcDay(Date.now() - (RISK_WINDOW_DAYS - 1) * 86_400_000);
  const historyOf = (p: (typeof pubRows)[number]) => dailyGains(snapsOf.get(p.id) ?? [], p.createdAt.getTime() >= snapSince ? utcDay(p.createdAt) : undefined)
    .filter((h) => h.day >= windowStart).map(({ day, views, likes, gain }) => ({ day, views, likes, gain }));
  const [viewsRun] = isAdmin ? await db.select().from(schema.jobRuns).where(eq(schema.jobRuns.name, VIEWS_JOB)) : [];
  // Recours contre un clip refusé : les siens pour un clipper, tous pour l'admin (avec l'auteur de la décision) ; aucun
  // pour une agence (message et preuve restent entre le clipper et l'équipe).
  const A = schema.appeals;
  const appealRows = isAdmin ? await db.select().from(A).orderBy(desc(A.createdAt))
    : isClipper ? await db.select().from(A).where(eq(A.userId, user.id)).orderBy(desc(A.createdAt)) : [];

  // Séries des graphiques.
  let series: { daily: number[]; label: string };
  if (isAdmin) {
    const rows = await db.select({ d: sql<string>`to_char(${schema.users.createdAt}, 'YYYY-MM-DD')`, v: sql<number>`count(*)` }).from(schema.users).where(and(ne(schema.users.role, "admin"), gte(schema.users.createdAt, since))).groupBy(sql`1`);
    series = { daily: daily30(rows), label: "Inscriptions par jour" };
  } else {
    const rows = await db.select({ d: sql<string>`to_char(${T.createdAt}, 'YYYY-MM-DD')`, v: sql<number>`sum(${T.amount})` }).from(T)
      .where(and(eq(T.type, "gain"), gte(T.createdAt, since), isAgency ? (campaignIds.length ? inArray(T.publicationId, pubRows.map((p) => p.id).concat("_")) : sql`false`) : eq(T.userId, user.id)))
      .groupBy(sql`1`);
    series = { daily: daily30(rows), label: isAgency ? "Budget consommé par jour (DA)" : "Gains par jour (DA)" };
  }

  // Soldes : pour chaque clipper visible par l'admin, et pour soi-même.
  const balanceTargets = isAdmin ? userRows.filter((u) => u.role === "clipper") : user.role === "clipper" ? [user] : [];
  const balanceOf = new Map<string, Awaited<ReturnType<typeof balances>>>();
  for (const u of balanceTargets) balanceOf.set(u.id, await balances(db, u.id));

  // Notifications antérieures aux liens : lien déduit du texte (voir inferLink).
  const linkCtx: LinkContext = { campaigns: campaignRows, publications: pubRows, transactions: txRows };

  return {
    me: {
      ...fullUser(user), favorites: mine.filter((m) => m.favorite).map((m) => m.campaignId), joinedCampaigns: mine.filter((m) => m.joined).map((m) => m.campaignId),
      ...(balanceOf.get(user.id) ?? {}), hasPassword: user.passwordHash !== "", providers: OAUTH_PROVIDERS.filter((p) => providers.includes(p)),
      ...(isClipper ? { socialAccounts: socialOf(user.id) } : {}),
    },
    settings: { maintenance: settings.maintenance, signupsOpen: settings.signupsOpen, announcement: settings.announcement, minWithdraw: settings.minWithdraw, commissionRate: settings.commissionRate, minBudget: settings.minBudget, holdDays: settings.holdDays, earningDays: settings.earningDays, instantFeePercent: settings.instantFeePercent, instantMinFee: settings.instantMinFee },
    users: userRows.map((u) => ({
      ...(isAdmin ? fullUser(u) : u.id === user.id ? fullUser(u) : publicUser(u)), ...(balanceOf.get(u.id) ?? {}),
      ...(u.role === "clipper" && (isAdmin || u.id === user.id) ? { socialAccounts: socialOf(u.id) } : {}),
    })),
    campaigns: campaignRows.map((c) => ({ ...c, createdAt: day(c.createdAt), updatedAt: c.updatedAt.toISOString(), clippers: clippersOf.get(c.id) ?? 0 })),
    agencies: agencyRows.map(publicAgency).sort((a, b) => a.name.localeCompare(b.name, "fr") || a.id.localeCompare(b.id)),
    // Score de risque, signaux et historique : pour l'admin seulement.
    publications: pubRows.map((p) => ({
      id: p.id, userId: p.userId, campaign: p.campaignId, title: p.title, platform: p.platform, url: p.url, batch: p.batch, views: p.views, likes: p.likes,
      checkedAt: p.checkedAt?.toISOString() ?? null, status: p.status, reason: p.reason, paid: p.paid, date: day(p.createdAt),
      ...(isAdmin ? { riskScore: p.riskScore, riskFlags: p.riskFlags, history: historyOf(p) } : {}),
    })),
    appeals: appealRows.map((a) => ({
      id: a.id, publicationId: a.publicationId, userId: a.userId, message: a.message, proof: a.proof, status: a.status, decisionNote: a.decisionNote,
      decidedAt: a.decidedAt?.toISOString() ?? null, createdAt: a.createdAt.toISOString(), ...(isAdmin ? { decidedBy: a.decidedBy } : {}),
    })),
    transactions: txRows.map((t) => ({ id: t.id, ref: t.ref, userId: t.userId, type: t.type, label: t.label, amount: t.amount, fee: t.fee, status: t.status, method: t.method, date: day(t.createdAt), time: time(t.createdAt), availableAt: t.availableAt?.toISOString() ?? null,
      // Paiement en ligne : passerelle (« chargily ») ; son identifiant chez Chargily pour l'équipe seulement (support).
      provider: t.provider, ...(isAdmin ? { providerRef: t.providerRef } : {}), document: docOf.get(t.id) ?? null })),
    notifications: notifRows.map((n) => ({ id: n.id, icon: n.icon, text: n.text, link: n.link ?? inferLink(user.role, n.text, linkCtx), unread: !n.read, at: n.createdAt.toISOString() })),
    activity: activityRows.map((a) => ({ icon: a.icon, text: a.text, at: a.createdAt.toISOString() })),
    series,
    // Paiement en ligne des recharges (agence, admin) : simulated, sans clé Chargily (page de paiement simulée de l'app,
    // en développement ; en production, le paiement en ligne est alors refusé).
    ...(isAdmin || isAgency ? { payments: { simulated: !chargilyConfigured() } } : {}),
    // Relevé automatique des vues (admin) : dernière exécution, son bilan, plateformes en mode simulé.
    ...(isAdmin ? { tracking: { everyHours: TRACK_EVERY_HOURS, lastRunAt: viewsRun?.lastRunAt.toISOString() ?? null, summary: viewsRun?.summary ?? null, simulated: simulatedPlatforms() } } : {}),
  };
}

/** Données publiques de la page d'accueil (aucune connexion requise). */
export async function publicState() {
  const db = await getDb();
  const settings = await getSettings();
  const C = schema.campaigns;
  const campaigns = await db.select({ id: C.id, title: C.title, brand: C.brand, category: C.category, rate: C.rate, budget: C.budget, spent: C.spent, minPayout: C.minPayout, maxPayout: C.maxPayout, emoji: C.emoji, gradient: C.gradient, image: C.image, top: C.top, platforms: C.platforms, createdAt: C.createdAt })
    .from(C).where(eq(C.status, "Active")).orderBy(desc(C.top), desc(C.createdAt)).limit(12);
  return {
    settings: { maintenance: settings.maintenance, signupsOpen: settings.signupsOpen, announcement: settings.announcement },
    campaigns: campaigns.map((c) => ({ ...c, createdAt: day(c.createdAt) })),
    // Boutons « Continuer avec … » des écrans de connexion et d'inscription : fournisseurs configurés sur ce serveur.
    oauth: configuredProviders(),
  };
}
