import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, isUniqueViolation, schema } from "../db";
import { PLATFORM_HOSTS } from "../gradients";
import type { User } from "../auth";
import { logActivity, notify } from "../events";
import { badRequest, notFound } from "../http";
import { newId, newRef } from "../ids";
import { link } from "../links";
import { belowMin, clipRisk, payoutDelta, RISK_WINDOW_DAYS, sentence, socialLinkError, utcDay, viewsFor } from "../rules";
import { getSettings } from "../settings";

const fmt = (n: number) => `${n.toLocaleString("fr-FR").replace(/ | /g, " ")} DA`;

/**
 * Un clip publié sur une ou plusieurs plateformes de la campagne : une publication par lien, toutes du même lot (`batch`).
 * Tous les liens sont contrôlés avant le moindre enregistrement : plateforme acceptée par la campagne,
 * lien https vers cette plateforme (PLATFORM_HOSTS), publié depuis le compte vérifié du clipper sur cette plateforme
 * (socialLinkError : compte vérifié, et même compte quand le lien le nomme), lien jamais soumis.
 * Le score de risque part de l'âge des comptes (« Compte récent ») ; les relevés de vues le complètent ensuite.
 */
export async function submitClip(user: User, input: { campaignId: string; title: string; links: { platform: string; url: string }[] }) {
  const db = await getDb();
  const [c] = await db.select().from(schema.campaigns).where(eq(schema.campaigns.id, input.campaignId));
  if (!c) throw notFound("Campagne introuvable");
  if (c.status !== "Active") throw badRequest("Cette campagne n'accepte plus de clips");
  const [member] = await db.select().from(schema.campaignMembers)
    .where(and(eq(schema.campaignMembers.campaignId, c.id), eq(schema.campaignMembers.userId, user.id), eq(schema.campaignMembers.joined, true)));
  if (!member) throw badRequest("Rejoignez la campagne avant de soumettre un clip");
  // Comptes sociaux vérifiés du clipper (Profil → Comptes sociaux), par plateforme.
  const S = schema.socialAccounts;
  const accounts = await db.select({ platform: S.platform, handle: S.handle, verifiedAt: S.verifiedAt }).from(S).where(and(eq(S.userId, user.id), eq(S.status, "verified")));
  const verified = new Map(accounts.map((a) => [a.platform, a.handle]));
  const links = input.links.map(({ platform, url: raw }) => {
    if (!c.platforms.includes(platform)) throw badRequest(`Cette campagne n'accepte pas ${platform}`);
    let url: URL | null = null;
    try {
      url = new URL(raw.trim());
    } catch {
      // Lien illisible : même message qu'un lien vers un autre site.
    }
    if (!url || url.protocol !== "https:" || !PLATFORM_HOSTS[platform]?.test(url.hostname)) throw badRequest(`Le lien doit être un lien ${platform} (https://…)`);
    const accountError = socialLinkError(platform, url.toString(), verified.get(platform));
    if (accountError) throw badRequest(accountError);
    return { platform, url: url.toString() };
  });
  const urls = links.map((l) => l.url);
  if (new Set(urls).size !== urls.length) throw badRequest("Le même lien est indiqué deux fois");
  // Lien déjà soumis (par ce clipper ou un autre) : le premier dans l'ordre de l'envoi est cité.
  const taken = new Set((await db.select({ url: schema.publications.url }).from(schema.publications).where(inArray(schema.publications.url, urls))).map((r) => r.url));
  const dup = urls.find((u) => taken.has(u));
  if (dup) throw badRequest(`Ce lien a déjà été soumis : ${dup}`);
  const title = input.title.trim(), batch = newId();
  const ids = links.map(() => newId()), now = Date.now();
  const risk = (platform: string) => clipRisk({ createdAt: now, views: 0, likes: null }, [], {
    userCreatedAt: user.createdAt.getTime(), socialVerifiedAt: accounts.find((a) => a.platform === platform)?.verifiedAt?.getTime() ?? null,
  });
  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema.publications).values(links.map((l, i) => {
        const { score, flags } = risk(l.platform);
        return { id: ids[i], userId: user.id, campaignId: c.id, title, platform: l.platform, url: l.url, batch, riskScore: score, riskFlags: flags, createdAt: new Date(now) };
      }));
      await logActivity(tx, "🎬", `${user.name} a soumis le clip « ${title} » (${c.title}).`);
    });
  } catch (err) {
    // Le même lien soumis au même instant par une autre requête (index unique sur l'URL).
    if (isUniqueViolation(err)) throw badRequest("Ce lien a déjà été soumis");
    throw err;
  }
  return { id: ids[0], ids };
}

/**
 * Une campagne ne paie que tant qu'elle est financée : active ou en pause. Terminée, son budget non consommé
 * (et la commission correspondante) a déjà été rendu à l'agence, ou il est entièrement dépensé.
 */
const paying = (c: { status: string }) => c.status === "Active" || c.status === "En pause";

/**
 * Relevé des vues d'un clip : saisi par l'équipe, ou par le relevé automatique (services/tracking.ts, `auto` : un
 * nombre inférieur au dernier relevé, que la plateforme a pu corriger, garde le dernier relevé au lieu d'être refusé).
 * `likes` : undefined ou null garde les likes connus. Chaque relevé remplace celui du jour dans l'historique
 * (view_snapshots), date le dernier relevé et recalcule le score de risque du clip.
 * Pendant la fenêtre de gains, un clip validé est payé pour ses vues supplémentaires, si sa campagne est encore financée.
 */
export async function recordViews(id: string, views: number, likes?: number | null, { auto = false } = {}) {
  const db = await getDb();
  const settings = await getSettings();
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(schema.publications).where(eq(schema.publications.id, id)).for("update");
    if (!p) throw notFound("Clip introuvable");
    if (views < p.views) {
      if (!auto) throw badRequest("Le nombre de vues ne peut pas diminuer");
      views = p.views;
    }
    const now = new Date(), nextLikes = likes ?? p.likes, V = schema.viewSnapshots;
    await tx.insert(V).values({ publicationId: id, day: utcDay(now), views, likes: nextLikes, recordedAt: now })
      .onConflictDoUpdate({ target: [V.publicationId, V.day], set: { views, likes: nextLikes, recordedAt: now } });
    const { score, flags } = await riskOf(tx, p, views, nextLikes);
    await tx.update(schema.publications).set({ views, likes: nextLikes, checkedAt: now, riskScore: score, riskFlags: flags }).where(eq(schema.publications.id, id));
    if (p.status !== "Validée" || !p.approvedAt) return;
    if (Date.now() - p.approvedAt.getTime() > settings.earningDays * 86_400_000) return;
    const [c] = await tx.select().from(schema.campaigns).where(eq(schema.campaigns.id, p.campaignId)).for("update");
    if (!paying(c)) return;
    const extra = payoutDelta(views, c, p.paid);
    if (!extra) return;
    await credit(tx, p, c, extra, `${c.title} · vues supplémentaires`, settings.holdDays);
  });
}

type Tx = Parameters<Parameters<Awaited<ReturnType<typeof getDb>>["transaction"]>[0]>[0];
type Pub = typeof schema.publications.$inferSelect;
type Camp = typeof schema.campaigns.$inferSelect;

/**
 * Score de risque d'un clip (clipRisk, lib/server/rules.ts) : ses derniers relevés jour par jour, l'inscription du
 * clipper et la vérification de son compte social sur la plateforme du clip.
 */
async function riskOf(tx: Tx, p: Pub, views: number, likes: number | null) {
  const V = schema.viewSnapshots, S = schema.socialAccounts;
  const latest = await tx.select({ day: V.day, views: V.views, likes: V.likes }).from(V).where(eq(V.publicationId, p.id)).orderBy(desc(V.day)).limit(RISK_WINDOW_DAYS + 2);
  const [u] = await tx.select({ createdAt: schema.users.createdAt }).from(schema.users).where(eq(schema.users.id, p.userId));
  const [social] = await tx.select({ verifiedAt: S.verifiedAt }).from(S).where(and(eq(S.userId, p.userId), eq(S.platform, p.platform), eq(S.status, "verified")));
  return clipRisk({ createdAt: p.createdAt.getTime(), views, likes }, latest, { userCreatedAt: u?.createdAt.getTime() ?? null, socialVerifiedAt: social?.verifiedAt?.getTime() ?? null });
}

async function credit(tx: Tx, p: Pub, c: Camp, amount: number, label: string, holdDays: number) {
  const spent = c.spent + amount;
  await tx.update(schema.publications).set({ paid: p.paid + amount }).where(eq(schema.publications.id, p.id));
  await tx.update(schema.campaigns).set({ spent, ...(spent >= c.budget ? { status: "Terminée" as const } : {}) }).where(eq(schema.campaigns.id, c.id));
  const txId = newId();
  await tx.insert(schema.transactions).values({
    id: txId, ref: newRef(), userId: p.userId, type: "gain", label, amount, status: "Validé",
    availableAt: new Date(Date.now() + holdDays * 86_400_000), publicationId: p.id,
  });
  await notify(tx, p.userId, "💸", `+${fmt(amount)} pour « ${p.title} ». Retirable dans ${holdDays} jours.`, link.clipperTx(txId));
  if (spent >= c.budget) {
    await notify(tx, c.ownerId, "🏁", `Le budget de « ${c.title} » est entièrement consommé : la campagne est terminée.`, link.agencyCampaign(c.id));
    await logActivity(tx, "🏁", `Campagne « ${c.title} » terminée (budget consommé).`);
  }
}

export async function reviewClip(admin: User, id: string, decision: { approve: true } | { approve: false; reason: string }) {
  const db = await getDb();
  const settings = await getSettings();
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(schema.publications).where(eq(schema.publications.id, id)).for("update");
    if (!p) throw notFound("Clip introuvable");
    if (p.status !== "En attente") throw badRequest("Ce clip a déjà été traité");
    if (!decision.approve) {
      await tx.update(schema.publications).set({ status: "Refusée", reason: decision.reason }).where(eq(schema.publications.id, id));
      await notify(tx, p.userId, "⚠️", `Clip « ${p.title} » refusé : ${sentence(decision.reason)}`, link.clip(p.id));
      await logActivity(tx, "🚫", `Clip « ${p.title} » refusé par ${admin.name}.`);
      return;
    }
    const [c] = await tx.select().from(schema.campaigns).where(eq(schema.campaigns.id, p.campaignId)).for("update");
    // Campagne terminée : son budget restant a été rendu à l'agence, un gain ne serait plus couvert. Le clip peut être refusé.
    if (!paying(c)) throw badRequest("Cette campagne est terminée : ce clip ne peut plus être validé");
    if (belowMin(p.views, c)) throw badRequest(`Seuil non atteint : ${viewsFor(c.minPayout, c.rate).toLocaleString("fr-FR")} vues minimum`);
    const now = new Date();
    await tx.update(schema.publications).set({ status: "Validée", approvedAt: now }).where(eq(schema.publications.id, id));
    const amount = payoutDelta(p.views, c, 0);
    if (amount > 0) await credit(tx, { ...p, status: "Validée", approvedAt: now }, c, amount, c.title, settings.holdDays);
    else await notify(tx, p.userId, "✅", `Votre clip « ${p.title} » a été validé.`, link.clip(p.id));
    await logActivity(tx, "✅", `Clip « ${p.title} » validé (${fmt(amount)}).`);
  });
}

export async function clipsCountByCampaign() {
  const db = await getDb();
  return db.select({ campaignId: schema.publications.campaignId, n: sql<number>`count(*)` }).from(schema.publications).groupBy(schema.publications.campaignId);
}
