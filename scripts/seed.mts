// Crée le compte administrateur (ADMIN_EMAIL / ADMIN_PASSWORD) et, avec --demo, des données d'exemple.
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import * as schema from "../lib/server/db/schema";
import { DEMO_APPEAL_MESSAGE, DEMO_PROOF_JPEG_BASE64 } from "../lib/server/demo-appeal";
import { newId, newRef } from "../lib/server/ids";
import { link } from "../lib/server/links";
import { hashPassword } from "../lib/server/password";
import { clipRisk, payoutFor, sentence, simulatedHistory, socialCode } from "../lib/server/rules";
import { DEFAULT_SETTINGS } from "../lib/server/settings";
import { openDb } from "./db";

const { db, migrate, close } = await openDb();
await migrate();

const adminEmail = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD ?? "";
if (!adminEmail || adminPassword.length < 10) {
  console.error("Définissez ADMIN_EMAIL et ADMIN_PASSWORD (10 caractères minimum) pour créer le compte administrateur.");
  process.exit(1);
}
const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, adminEmail));
if (!existing) {
  await db.insert(schema.users).values({ id: newId(), role: "admin", email: adminEmail, name: "Équipe ClipBoost", passwordHash: await hashPassword(adminPassword) });
  console.log(`Administrateur créé : ${adminEmail}`);
} else console.log(`Administrateur déjà présent : ${adminEmail}`);

if (process.argv.includes("--demo")) {
  const [any] = await db.select({ id: schema.campaigns.id }).from(schema.campaigns).limit(1);
  if (any) {
    console.log("Des campagnes existent déjà : données d'exemple ignorées.");
  } else {
    const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
    const pwd = await hashPassword("Clipboost2026");
    const U = (role: "clipper" | "agence", name: string, email: string, extra: Partial<typeof schema.users.$inferInsert> = {}) =>
      ({ id: newId(), role, name, email, passwordHash: pwd, ...extra });
    const yacine = U("clipper", "Yacine Benali", "yacine@clipboost.dz", { level: "Clipper Argent", bio: "Monteur passionné de foot et d'humour.", handles: { tiktok: "@yacine.clips", instagram: "@yacine.clips", youtube: "@yacineclips" }, payoutMethod: "CCP", payoutAccount: "0021234567 clé 89", createdAt: daysAgo(210) });
    const amira = U("clipper", "Amira Khelifi", "amira@clipboost.dz", { level: "Clipper Or", bio: "Lifestyle et mode à Oran.", handles: { instagram: "@amira.style" }, payoutMethod: "BaridiMob", payoutAccount: "00799999001234567890", createdAt: daysAgo(190) });
    const lina = U("clipper", "Lina Mansouri", "lina@clipboost.dz", { level: "Clipper Bronze", handles: { tiktok: "@lina.lol", youtube: "@lina.lol" }, createdAt: daysAgo(60) });
    const tassili = U("agence", "Tassili Sport", "agence@clipboost.dz", { contact: "Nassim Ait Ali", bio: "Équipementier sportif algérien : maillots, ballons et tenues d'entraînement. Nous cherchons des clippers passionnés de foot pour faire vivre chaque match.", credit: 400000, createdAt: daysAgo(240) });
    // Hoggar a demandé le badge de vérification (en attente de l'équipe) ; Djurdjura est déjà vérifiée.
    const hoggar = U("agence", "Hoggar Boissons", "hoggar@clipboost.dz", { contact: "Meriem Saadi", bio: "Boissons fraîches produites en Algérie, du Hoggar à la côte. Nos campagnes célèbrent les soirées d'été entre amis.", credit: 0, verification: "pending", verificationNote: "Marque déposée en Algérie depuis 2015, registre du commerce disponible sur demande.", createdAt: daysAgo(3) });
    const djurdjura = U("agence", "Djurdjura Médias", "djurdjura@clipboost.dz", { contact: "Karim Ouali", country: "Algérie", bio: "Studio de production basé à Tizi Ouzou : courts-métrages, clips musicaux et documentaires.", credit: 150000, verification: "verified", createdAt: daysAgo(120) });
    await db.insert(schema.users).values([yacine, amira, lina, tassili, hoggar, djurdjura]);

    // Comptes sociaux vérifiés (code dans la bio) sur les plateformes de leurs clips ; Amira a aussi un compte TikTok
    // en attente de vérification (code à coller dans sa bio). Les « @compte » des profils (handles) sont ceux-là.
    const codes = new Set<string>();
    const social = (u: typeof yacine, platform: string, handle: string, verifiedDaysAgo: number | null) => {
      let code = socialCode(randomBytes(4));
      while (codes.has(code)) code = socialCode(randomBytes(4));
      codes.add(code);
      const at = verifiedDaysAgo === null ? null : daysAgo(verifiedDaysAgo);
      return { id: newId(), userId: u.id, platform, handle, code, status: at ? "verified" as const : "pending" as const, verifiedAt: at, checkedAt: at, createdAt: daysAgo(verifiedDaysAgo === null ? 0.2 : verifiedDaysAgo + 0.01) };
    };
    const socialRows = [
      social(yacine, "TikTok", "yacine.clips", 30), social(yacine, "Instagram", "yacine.clips", 12), social(yacine, "YouTube", "yacineclips", 12),
      social(amira, "Instagram", "amira.style", 25), social(amira, "TikTok", "amira.style", null),
      social(lina, "TikTok", "lina.lol", 40), social(lina, "YouTube", "lina.lol", 15),
    ];
    await db.insert(schema.socialAccounts).values(socialRows);

    const C = (ownerId: string | null, title: string, brand: string, category: string, rate: number, budget: number, status: schema.CampaignStatus, emoji: string, gradient: string, platforms: string[], rules: string[], extra: Partial<typeof schema.campaigns.$inferInsert> = {}) =>
      ({ id: newId(), ownerId, title, brand, category, rate, budget, status, emoji, gradient, platforms, rules, minPayout: rate * 2, maxPayout: rate * 200, commissionRate: ownerId ? 15 : 0, reserved: ownerId && status !== "En attente" ? Math.round(budget * 1.15) : 0, ...extra, updatedAt: extra.updatedAt ?? extra.createdAt });
    const derby = C(tassili.id, "Derby Algérois", "Tassili Sport", "Sport", 150, 600000, "Active", "⚽", "from-emerald-400 via-teal-500 to-cyan-600", ["TikTok", "Instagram", "YouTube"], ["Clip de 15 à 60 secondes", "Mentionner @tassilisport", "Pas de musique protégée"], { top: true, createdAt: daysAgo(10) });
    const maillot = C(tassili.id, "Nouveau maillot 2027", "Tassili Sport", "Sport", 140, 300000, "En pause", "👕", "from-emerald-500 via-green-600 to-teal-700", ["Instagram", "TikTok"], ["Porter le maillot à l'écran", "Mentionner @tassilisport"], { createdAt: daysAgo(27) });
    const soirees = C(hoggar.id, "Spécial Soirées d'Été", "Hoggar Boissons", "Food", 135, 500000, "En attente", "🥤", "from-cyan-300 via-sky-500 to-blue-600", ["TikTok", "Instagram"], ["Montrer la bouteille", "Ambiance soirée entre amis"], { createdAt: daysAgo(2) });
    const kahwa = C(null, "Kahwa du matin", "Kahwa Lounge", "Food", 110, 250000, "Active", "☕", "from-amber-300 via-orange-400 to-rose-500", ["TikTok", "Instagram"], ["Montrer le produit dans les 3 premières secondes", "Ajouter #KahwaDuMatin"], { createdAt: daysAgo(14) });
    const rire = C(null, "Les Sketchs du Bled", "Studio Numidia", "Humour", 125, 220000, "Active", "😂", "from-rose-400 via-pink-500 to-purple-600", ["TikTok", "YouTube"], ["Humour bienveillant", "Mentionner @studionumidia"], { maxPayout: 6000, createdAt: daysAgo(20) });
    // Campagne refusée par l'équipe (motif affiché à l'agence, qui peut la modifier et la relancer, ou la supprimer).
    const coupe = C(tassili.id, "Coupe d'Algérie : les plus beaux gestes", "Tassili Sport", "Sport", 130, 250000, "Refusée", "🏆", "from-lime-300 via-green-400 to-emerald-600", ["TikTok", "Facebook"], ["Clip de 15 à 45 secondes", "Mentionner @tassilisport"], { reserved: 0, reviewNote: "Les règles doivent préciser les dates de la compétition et le logo officiel à afficher.", createdAt: daysAgo(4), updatedAt: daysAgo(3.5) });
    const festival = C(djurdjura.id, "Festival du court-métrage", "Djurdjura Médias", "Cinéma", 120, 300000, "Active", "🎬", "from-violet-500 via-fuchsia-500 to-pink-500", ["YouTube", "Facebook", "Instagram"], ["Extrait de 30 à 90 secondes", "Mentionner @djurdjuramedias", "Pas de spoiler de la fin"], { createdAt: daysAgo(6) });
    await db.insert(schema.campaigns).values([derby, maillot, soirees, kahwa, rire, coupe, festival]);

    const join = (u: { id: string }, c: { id: string }, favorite = false) => ({ campaignId: c.id, userId: u.id, joined: true, favorite });
    await db.insert(schema.campaignMembers).values([join(yacine, derby, true), join(yacine, kahwa), join(yacine, rire, true), join(amira, kahwa), join(amira, derby), join(lina, rire)]);

    // Journal d'activité et notifications des événements de démo (mêmes textes que les services, lib/server/services/*).
    const fmt = (n: number) => `${n.toLocaleString("fr-FR").replace(/\u202f|\xa0/g, " ")} DA`;
    const acts: [number, string, string][] = [];
    const notes: [{ id: string }, number, string, string, string][] = [];
    const launched = (c: typeof derby, days: number) => {
      for (const u of [yacine, amira, lina]) if ((u.createdAt as Date) < daysAgo(days)) notes.push([u, days, "🎯", `Nouvelle campagne : ${c.title} (${c.rate} DA /1K).`, link.clipperCampaign(c.id)]);
    };
    launched(rire, 20); launched(kahwa, 14);
    notes.push([tassili, 10, "⏳", `Votre campagne « ${derby.title} » est en cours de vérification.`, link.agencyCampaign(derby.id)], [tassili, 9.9, "✅", `Votre campagne « ${derby.title} » a été approuvée et est en ligne.`, link.agencyCampaign(derby.id)]);
    acts.push([9.9, "🎯", `Campagne « ${derby.title} » : En attente → Active.`]);
    launched(derby, 9.9);
    acts.push([3, "🏢", `${hoggar.name} s'est inscrit (agence).`]);
    acts.push([2, "🏢", `${hoggar.name} a soumis la campagne « ${soirees.title} ».`]);
    notes.push([hoggar, 2, "⏳", `Votre campagne « ${soirees.title} » est en cours de vérification.`, link.agencyCampaign(soirees.id)]);
    // Campagne refusée avec un motif : l'agence peut la corriger et la relancer, ou la supprimer.
    acts.push([4, "🏢", `${tassili.name} a soumis la campagne « ${coupe.title} ».`], [3.5, "🎯", `Campagne « ${coupe.title} » : En attente → Refusée.`]);
    notes.push([tassili, 4, "⏳", `Votre campagne « ${coupe.title} » est en cours de vérification.`, link.agencyCampaign(coupe.id)],
      [tassili, 3.5, "⚠️", `Votre campagne « ${coupe.title} » a été refusée : ${sentence(coupe.reviewNote!)}`, link.agencyCampaign(coupe.id)]);
    // Agence vérifiée (badge bleu) : sa campagne approuvée et annoncée aux clippers, comme le derby.
    notes.push([djurdjura, 6, "⏳", `Votre campagne « ${festival.title} » est en cours de vérification.`, link.agencyCampaign(festival.id)], [djurdjura, 5.9, "✅", `Votre campagne « ${festival.title} » a été approuvée et est en ligne.`, link.agencyCampaign(festival.id)]);
    acts.push([5.9, "🎯", `Campagne « ${festival.title} » : En attente → Active.`]);
    launched(festival, 5.9);
    // Demande de badge de vérification en attente de l'équipe.
    acts.push([1.5, "🛡️", `${hoggar.name} demande le badge de vérification.`]);
    const nameOf = (id: string) => [yacine, amira, lina].find((u) => u.id === id)!.name;
    for (const a of socialRows) if (a.verifiedAt) acts.push([(Date.now() - a.verifiedAt.getTime()) / 86_400_000, "🛡️", `${nameOf(a.userId)} a vérifié son compte ${a.platform} @${a.handle}.`]);

    // Clips : certains validés et payés, d'autres en attente (dont un sous le seuil).
    // Historique jour par jour des vues (relevé automatique, le dernier il y a 2 heures) et score de risque : « Quand ta mère
    // trouve ton bulletin » a un pic de vues soudain avec très peu de likes (risque élevé), l'Instagram du but de la 89e a
    // peu de likes (risque moyen).
    // Le « But de la 89e » a été publié sur TikTok et Instagram en un seul envoi : deux publications du même lot (batch),
    // un seul événement « a soumis le clip » dans le journal.
    const goalBatch = newId();
    const pubs: { u: typeof yacine; c: typeof derby; title: string; platform: string; views: number; status: schema.PublicationStatus; days: number; reason?: string; url?: string; batch?: string; sibling?: boolean; likeRate?: number; spike?: boolean }[] = [
      { u: yacine, c: derby, title: "But de la 89e en slow-motion", platform: "TikTok", views: 48200, status: "Validée", days: 2, batch: goalBatch },
      { u: yacine, c: derby, title: "But de la 89e en slow-motion", platform: "Instagram", views: 12500, status: "En attente", days: 2, url: "https://www.instagram.com/reel/demo-batch", batch: goalBatch, sibling: true, likeRate: 0.003 },
      { u: yacine, c: rire, title: "Le taxi clandestin", platform: "TikTok", views: 63400, status: "Validée", days: 8 },
      { u: yacine, c: kahwa, title: "Mon café du matin à Alger", platform: "TikTok", views: 9800, status: "Validée", days: 6 },
      { u: amira, c: kahwa, title: "Brunch à Oran", platform: "Instagram", views: 18800, status: "Validée", days: 5 },
      { u: amira, c: derby, title: "Ambiance des tribunes", platform: "Instagram", views: 31200, status: "En attente", days: 1 },
      { u: lina, c: rire, title: "Quand ta mère trouve ton bulletin", platform: "TikTok", views: 52900, status: "En attente", days: 1, likeRate: 0.0007, spike: true },
      { u: yacine, c: derby, title: "Les supporters chantent", platform: "YouTube", views: 1600, status: "En attente", days: 0 },
      { u: lina, c: rire, title: "Sketch du marché", platform: "YouTube", views: 4100, status: "Refusée", days: 9, reason: "Musique protégée" },
    ];
    let i = 0, tracked = 0, sketchId = "";
    const lastRun = new Date(Date.now() - 2 * 3_600_000), earningMs = DEFAULT_SETTINGS.earningDays * 86_400_000;
    for (const p of pubs) {
      // Un lien TikTok nomme le compte : celui que le clipper a vérifié.
      const id = newId(), host = ({ TikTok: `www.tiktok.com/${p.u.handles?.tiktok}/video/`, Instagram: "www.instagram.com/reel/", Facebook: "www.facebook.com/reel/" } as Record<string, string>)[p.platform] ?? "youtu.be/";
      const paid = p.status === "Validée" ? payoutFor(p.views, p.c) : 0;
      // Suivi : jusqu'au dernier relevé, jusqu'au refus, ou jusqu'à la fin de la fenêtre de gains d'un clip validé.
      const createdAt = daysAgo(p.days + 1).getTime(), decidedAt = daysAgo(p.days).getTime();
      const endAt = p.status === "Refusée" ? decidedAt : Math.min(lastRun.getTime(), p.status === "Validée" ? decidedAt + earningMs : Infinity);
      if (endAt === lastRun.getTime()) tracked++;
      const snaps = simulatedHistory(id, createdAt, endAt, p.views, { likeRate: p.likeRate, spike: p.spike }), last = snaps.at(-1);
      const social = socialRows.find((a) => a.userId === p.u.id && a.platform === p.platform && a.verifiedAt);
      const risk = clipRisk({ createdAt, views: p.views, likes: last?.likes ?? null }, snaps, { userCreatedAt: (p.u.createdAt as Date).getTime(), socialVerifiedAt: social?.verifiedAt?.getTime() ?? null });
      await db.insert(schema.publications).values({
        id, userId: p.u.id, campaignId: p.c.id, title: p.title, platform: p.platform, url: p.url ?? `https://${host}demo${++i}`, batch: p.batch ?? null, views: p.views, status: p.status, reason: p.reason, paid,
        approvedAt: p.status === "Validée" ? daysAgo(p.days) : null, createdAt: new Date(createdAt),
        likes: last?.likes ?? null, checkedAt: last ? new Date(last.at) : null, riskScore: risk.score, riskFlags: risk.flags,
      });
      if (snaps.length) await db.insert(schema.viewSnapshots).values(snaps.map((x) => ({ publicationId: id, day: x.day, views: x.views, likes: x.likes, recordedAt: new Date(x.at) })));
      const txId = newId();
      if (paid) {
        await db.insert(schema.transactions).values({ id: txId, ref: newRef(), userId: p.u.id, type: "gain", label: p.c.title, amount: paid, status: "Validé", availableAt: daysAgo(p.days - 3), publicationId: id, createdAt: daysAgo(p.days) });
        p.c.spent = (p.c.spent ?? 0) + paid;
      }
      if (!p.sibling) acts.push([p.days + 1, "🎬", `${p.u.name} a soumis le clip « ${p.title} » (${p.c.title}).`]);
      if (paid) {
        acts.push([p.days, "✅", `Clip « ${p.title} » validé (${fmt(paid)}).`]);
        notes.push([p.u, p.days, "💸", `+${fmt(paid)} pour « ${p.title} ». Retirable dans ${DEFAULT_SETTINGS.holdDays} jours.`, link.clipperTx(txId)]);
      } else if (p.status === "Refusée") {
        acts.push([p.days, "🚫", `Clip « ${p.title} » refusé par Équipe ClipBoost.`]);
        notes.push([p.u, p.days, "⚠️", `Clip « ${p.title} » refusé : ${sentence(p.reason!)}`, link.clip(id)]);
        if (p.title === "Sketch du marché") sketchId = id;
      }
    }
    // Recours en attente : Lina conteste le refus de « Sketch du marché » (musique libre de droits), capture d'écran à
    // l'appui, rangée dans la table media comme toute image envoyée. L'équipe l'examine dans la modération (onglet Recours).
    const proofId = newId(), appealId = newId();
    await db.insert(schema.media).values({ id: proofId, ownerId: lina.id, mime: "image/jpeg", data: DEMO_PROOF_JPEG_BASE64, createdAt: daysAgo(0.6) });
    await db.insert(schema.appeals).values({ id: appealId, publicationId: sketchId, userId: lina.id, message: DEMO_APPEAL_MESSAGE, proof: `/api/media/${proofId}`, createdAt: daysAgo(0.6) });
    acts.push([0.6, "⚖️", `${lina.name} a contesté le refus du clip « Sketch du marché ».`]);
    for (const c of [derby, rire, kahwa]) await db.update(schema.campaigns).set({ spent: c.spent }).where(eq(schema.campaigns.id, c.id));
    // Dernier relevé automatique des vues (tâche « views » de job_runs, toutes les 6 heures), tout en mode simulé.
    await db.insert(schema.jobRuns).values({ name: "views", lastRunAt: lastRun, summary: { by: "cron", total: tracked, updated: tracked, simulated: tracked, failed: 0 } });
    const withdrawalId = newId(), rechargeId = newId();
    await db.insert(schema.transactions).values({ id: withdrawalId, ref: newRef(), userId: amira.id, type: "retrait", label: "Retrait vers BaridiMob", amount: -2000, status: "En cours", method: "BaridiMob", createdAt: daysAgo(1) });
    const rechargeRef = newRef();
    await db.insert(schema.transactions).values({ id: rechargeId, ref: rechargeRef, userId: hoggar.id, type: "recharge", label: "Recharge par virement bancaire", amount: 600000, status: "En cours", method: "virement bancaire", createdAt: daysAgo(1) });
    acts.push([1, "💸", `${amira.name} a demandé un retrait de ${fmt(2000)}.`]);
    for (const admin of await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.role, "admin"))) {
      notes.push([admin, 2, "🏢", `${hoggar.name} a soumis la campagne « ${soirees.title} ».`, link.adminCampaign(soirees.id)], [admin, 1, "💸", `${amira.name} demande un retrait de ${fmt(2000)}.`, link.adminPayment(withdrawalId)],
        [admin, 0.9, "🏦", `${hoggar.name} annonce une recharge de ${fmt(600000)} par virement bancaire (réf. ${rechargeRef}).`, link.adminPayment(rechargeId)],
        [admin, 1.5, "🛡️", `${hoggar.name} demande le badge de vérification.`, link.adminUser(hoggar.id)],
        [admin, 0.6, "⚖️", `${lina.name} conteste le refus du clip « Sketch du marché ».`, link.adminAppeal(appealId)]);
    }
    // Les événements de plus de 2 jours sont déjà lus ; les plus récents restent à lire.
    await db.insert(schema.activity).values(acts.map(([days, icon, text]) => ({ id: newId(), icon, text, createdAt: daysAgo(days) })));
    await db.insert(schema.notifications).values(notes.map(([u, days, icon, text, href]) => ({ id: newId(), userId: u.id, icon, text, link: href, read: days > 2, createdAt: daysAgo(days) })));
    console.log("Données d'exemple créées (mot de passe des comptes d'exemple : Clipboost2026).");
    console.log("Comptes : yacine@, amira@, lina@ (clippers), agence@ (Tassili Sport), hoggar@ (badge demandé), djurdjura@ (agence vérifiée) — @clipboost.dz.");
  }
}
await close();
