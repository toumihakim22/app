// Données de démarrage de la version autonome : le compte administrateur et les mêmes
// données d'exemple que `scripts/seed.mts --demo`, datées par rapport au premier lancement.
import type { CampaignStatus, PublicationStatus } from "../../lib/server/db/schema";
import { DEMO_DRAFT_LESSON } from "../../lib/server/demo-academy";
import { lessonCreatedText } from "../../lib/server/academy";
import { DEMO_APPEAL_MESSAGE, DEMO_PROOF_DATA_URL } from "../../lib/server/demo-appeal";
import { DEMO_CONTENDERS, demoLastWeek } from "../../lib/server/demo-leaderboard";
import { DEMO_REFEREE_PAYOUT, DEMO_REFEREES, DEMO_REFERRAL_CODE } from "../../lib/server/demo-referrals";
import { demoThreads } from "../../lib/server/demo-messages";
import { numberDocuments } from "../../lib/server/documents";
import { clipRisk, payoutFor, prizeLabel, prizeNotice, referralLabel, referralNotice, referralPaidText, sentence, simulatedHistory, weekClosedText } from "../../lib/server/rules";
import { link } from "../../lib/server/links";
import { DEFAULT_SETTINGS } from "../../lib/server/settings";
import { emptyStore, starterLessons, insertCampaign, insertPublication, insertTransaction, insertUser, newId, newRef, newSocialCode, type CampaignRow, type Store, type UserRow } from "./db";
import { hashPassword } from "./password";

export const ADMIN_EMAIL = "admin@clipboost.dz";
export const ADMIN_PASSWORD = "AdminClip2026";
export const DEMO_PASSWORD = "Clipboost2026";

export async function seed(): Promise<Store> {
  const db = emptyStore();
  insertUser(db, { id: newId(), role: "admin", email: ADMIN_EMAIL, name: "Équipe ClipBoost", passwordHash: await hashPassword(ADMIN_PASSWORD) });

  const daysAgo = (n: number) => Date.now() - n * 86_400_000;
  const U = async (role: "clipper" | "agence", name: string, email: string, extra: Partial<UserRow> = {}) =>
    insertUser(db, { id: newId(), role, name, email, passwordHash: await hashPassword(DEMO_PASSWORD), ...extra });
  // Chaque clipper reçoit un code de parrainage (insertUser) ; celui de Yacine est fixe (DEMO_REFERRAL_CODE).
  const yacine = await U("clipper", "Yacine Benali", "yacine@clipboost.dz", { referralCode: DEMO_REFERRAL_CODE, level: "Clipper Argent", bio: "Monteur passionné de foot et d'humour.", handles: { tiktok: "@yacine.clips", instagram: "@yacine.clips", youtube: "@yacineclips" }, payoutMethod: "CCP", payoutAccount: "0021234567 clé 89", createdAt: daysAgo(210) });
  const amira = await U("clipper", "Amira Khelifi", "amira@clipboost.dz", { level: "Clipper Or", bio: "Lifestyle et mode à Oran.", handles: { instagram: "@amira.style" }, payoutMethod: "BaridiMob", payoutAccount: "00799999001234567890", createdAt: daysAgo(190) });
  const lina = await U("clipper", "Lina Mansouri", "lina@clipboost.dz", { level: "Clipper Bronze", handles: { tiktok: "@lina.lol", youtube: "@lina.lol" }, createdAt: daysAgo(60) });
  const tassili = await U("agence", "Tassili Sport", "agence@clipboost.dz", { contact: "Nassim Ait Ali", bio: "Équipementier sportif algérien : maillots, ballons et tenues d'entraînement. Nous cherchons des clippers passionnés de foot pour faire vivre chaque match.", credit: 400000, createdAt: daysAgo(240) });
  const hoggar = await U("agence", "Hoggar Boissons", "hoggar@clipboost.dz", { contact: "Meriem Saadi", bio: "Boissons fraîches produites en Algérie, du Hoggar à la côte. Nos campagnes célèbrent les soirées d'été entre amis.", credit: 0, verification: "pending", verificationNote: "Marque déposée en Algérie depuis 2015, registre du commerce disponible sur demande.", createdAt: daysAgo(3) });
  // Clippers de plus pour le classement hebdomadaire (lib/server/demo-leaderboard.ts) : un compte vérifié et un clip validé chacun.
  const contenders: { d: (typeof DEMO_CONTENDERS)[number]; u: UserRow }[] = [];
  for (const d of DEMO_CONTENDERS) contenders.push({ d, u: await U("clipper", d.name, d.email, { level: d.level, handles: { [d.platform.toLowerCase()]: `@${d.handle}` }, createdAt: daysAgo(d.createdDaysAgo) }) });
  // Parrainage (lib/server/demo-referrals.ts) : filleuls de Yacine ; Karim retire vers son propre compte BaridiMob.
  for (const u of db.users) if (DEMO_REFEREES.includes(u.email)) u.referredBy = yacine.id;
  const karim = db.users.find((u) => u.email === DEMO_REFEREE_PAYOUT.email)!;
  Object.assign(karim, { payoutMethod: DEMO_REFEREE_PAYOUT.method, payoutAccount: DEMO_REFEREE_PAYOUT.account });
  const djurdjura = await U("agence", "Djurdjura Médias", "djurdjura@clipboost.dz", { contact: "Karim Ouali", country: "Algérie", bio: "Studio de production basé à Tizi Ouzou : courts-métrages, clips musicaux et documentaires.", credit: 150000, verification: "verified", createdAt: daysAgo(120) });

  const C = (ownerId: string | null, title: string, brand: string, category: string, rate: number, budget: number, status: CampaignStatus, emoji: string, gradient: string, platforms: string[], rules: string[], extra: Partial<CampaignRow> = {}) =>
    insertCampaign(db, { id: newId(), ownerId, title, brand, category, rate, budget, status, emoji, gradient, platforms, rules, minPayout: rate * 2, maxPayout: rate * 200, commissionRate: ownerId ? 15 : 0, reserved: ownerId && status !== "En attente" ? Math.round(budget * 1.15) : 0, ...extra });
  const derby = C(tassili.id, "Derby Algérois", "Tassili Sport", "Sport", 150, 600000, "Active", "⚽", "from-emerald-400 via-teal-500 to-cyan-600", ["TikTok", "Instagram", "YouTube"], ["Clip de 15 à 60 secondes", "Mentionner @tassilisport", "Pas de musique protégée"], { top: true, createdAt: daysAgo(10) });
  C(tassili.id, "Nouveau maillot 2027", "Tassili Sport", "Sport", 140, 300000, "En pause", "👕", "from-emerald-500 via-green-600 to-teal-700", ["Instagram", "TikTok"], ["Porter le maillot à l'écran", "Mentionner @tassilisport"], { createdAt: daysAgo(27) });
  C(hoggar.id, "Spécial Soirées d'Été", "Hoggar Boissons", "Food", 135, 500000, "En attente", "🥤", "from-cyan-300 via-sky-500 to-blue-600", ["TikTok", "Instagram"], ["Montrer la bouteille", "Ambiance soirée entre amis"], { createdAt: daysAgo(2) });
  const kahwa = C(null, "Kahwa du matin", "Kahwa Lounge", "Food", 110, 250000, "Active", "☕", "from-amber-300 via-orange-400 to-rose-500", ["TikTok", "Instagram"], ["Montrer le produit dans les 3 premières secondes", "Ajouter #KahwaDuMatin"], { createdAt: daysAgo(14) });
  const rire = C(null, "Les Sketchs du Bled", "Studio Numidia", "Humour", 125, 220000, "Active", "😂", "from-rose-400 via-pink-500 to-purple-600", ["TikTok", "YouTube"], ["Humour bienveillant", "Mentionner @studionumidia"], { maxPayout: 6000, createdAt: daysAgo(20) });
  // Campagne refusée par l'équipe (à corriger et relancer, ou à supprimer) et campagne d'une agence vérifiée.
  const coupe = C(tassili.id, "Coupe d'Algérie : les plus beaux gestes", "Tassili Sport", "Sport", 130, 250000, "Refusée", "🏆", "from-lime-300 via-green-400 to-emerald-600", ["TikTok", "Facebook"], ["Clip de 15 à 45 secondes", "Mentionner @tassilisport"],
    { reserved: 0, reviewNote: "Les règles doivent préciser les dates de la compétition et le logo officiel à afficher.", createdAt: daysAgo(4), updatedAt: daysAgo(3.5) });
  const festival = C(djurdjura.id, "Festival du court-métrage", "Djurdjura Médias", "Cinéma", 120, 300000, "Active", "🎬", "from-violet-500 via-fuchsia-500 to-pink-500", ["YouTube", "Facebook", "Instagram"], ["Extrait de 30 à 90 secondes", "Mentionner @djurdjuramedias", "Pas de spoiler de la fin"], { createdAt: daysAgo(6) });

  // Comptes sociaux vérifiés (code dans la bio) sur les plateformes de leurs clips ; Amira a aussi un compte TikTok
  // en attente de vérification (code à coller dans sa bio). Les « @compte » des profils (handles) sont ceux-là.
  const social = (u: UserRow, platform: string, handle: string, verifiedDaysAgo: number | null) => db.social.push({
    id: newId(), userId: u.id, platform, handle, code: newSocialCode(db), status: verifiedDaysAgo === null ? "pending" : "verified",
    verifiedAt: verifiedDaysAgo === null ? null : daysAgo(verifiedDaysAgo), checkedAt: verifiedDaysAgo === null ? null : daysAgo(verifiedDaysAgo),
    createdAt: daysAgo(verifiedDaysAgo === null ? 0.2 : verifiedDaysAgo + 0.01),
  });
  social(yacine, "TikTok", "yacine.clips", 30); social(yacine, "Instagram", "yacine.clips", 12); social(yacine, "YouTube", "yacineclips", 12);
  social(amira, "Instagram", "amira.style", 25); social(amira, "TikTok", "amira.style", null);
  social(lina, "TikTok", "lina.lol", 40); social(lina, "YouTube", "lina.lol", 15);
  for (const { d, u } of contenders) social(u, d.platform, d.handle, d.verifiedDaysAgo);

  const userOf = (id: string) => db.users.find((u) => u.id === id)!;
  const join = (u: UserRow, c: CampaignRow, favorite = false) => db.members.push({ campaignId: c.id, userId: u.id, joined: true, favorite, createdAt: Date.now() });
  join(yacine, derby, true); join(yacine, kahwa); join(yacine, rire, true); join(amira, kahwa); join(amira, derby); join(lina, rire);
  for (const { d, u } of contenders) join(u, { derby, kahwa, rire }[d.clip.campaign]);

  // Clips : certains validés et payés, d'autres en attente (dont un sous le seuil). Le but de la 89e est publié sur
  // TikTok et Instagram : deux publications du même lot (envoyées ensemble, une seule ligne au journal).
  // Historique jour par jour des vues (relevé automatique, le dernier il y a 2 heures) et score de risque : « Quand ta mère
  // trouve ton bulletin » a un pic de vues soudain avec très peu de likes (risque élevé), l'Instagram du but de la 89e a
  // peu de likes (risque moyen).
  const batch89 = newId();
  const pubs: { u: UserRow; c: CampaignRow; title: string; platform: string; views: number; status: PublicationStatus; days: number; reason?: string; url?: string; batch?: string; sibling?: boolean; likeRate?: number; spike?: boolean }[] = [
    { u: yacine, c: derby, title: "But de la 89e en slow-motion", platform: "TikTok", views: 48200, status: "Validée", days: 2, batch: batch89 },
    { u: yacine, c: derby, title: "But de la 89e en slow-motion", platform: "Instagram", views: 12500, status: "En attente", days: 2, url: "https://www.instagram.com/reel/demo-batch", batch: batch89, sibling: true, likeRate: 0.003 },
    { u: yacine, c: rire, title: "Le taxi clandestin", platform: "TikTok", views: 63400, status: "Validée", days: 8 },
    { u: yacine, c: kahwa, title: "Mon café du matin à Alger", platform: "TikTok", views: 9800, status: "Validée", days: 6 },
    { u: amira, c: kahwa, title: "Brunch à Oran", platform: "Instagram", views: 18800, status: "Validée", days: 5 },
    { u: amira, c: derby, title: "Ambiance des tribunes", platform: "Instagram", views: 31200, status: "En attente", days: 1 },
    { u: lina, c: rire, title: "Quand ta mère trouve ton bulletin", platform: "TikTok", views: 52900, status: "En attente", days: 1, likeRate: 0.0007, spike: true },
    { u: yacine, c: derby, title: "Les supporters chantent", platform: "YouTube", views: 1600, status: "En attente", days: 0 },
    { u: lina, c: rire, title: "Sketch du marché", platform: "YouTube", views: 4100, status: "Refusée", days: 9, reason: "Musique protégée" },
    ...contenders.map(({ d, u }) => ({ u, c: { derby, kahwa, rire }[d.clip.campaign], title: d.clip.title, platform: d.platform, views: d.clip.views, status: "Validée" as const, days: d.clip.days })),
  ];
  // Journal d'activité et notifications des événements ci-dessus (mêmes textes que les services, lib/server/services/*).
  const fmt = (n: number) => `${n.toLocaleString("fr-FR").replace(/\u202f|\xa0/g, " ")} DA`;
  const acts: [number, string, string][] = [];
  const notes: [UserRow, number, string, string, string][] = [];
  const launched = (c: CampaignRow, days: number) => {
    for (const u of [yacine, amira, lina]) if (u.createdAt < daysAgo(days)) notes.push([u, days, "🎯", `Nouvelle campagne : ${c.title} (${c.rate} DA /1K).`, link.clipperCampaign(c.id)]);
  };
  launched(rire, 20); launched(kahwa, 14);
  notes.push([tassili, 10, "⏳", `Votre campagne « ${derby.title} » est en cours de vérification.`, link.agencyCampaign(derby.id)], [tassili, 9.9, "✅", `Votre campagne « ${derby.title} » a été approuvée et est en ligne.`, link.agencyCampaign(derby.id)]);
  acts.push([9.9, "🎯", `Campagne « ${derby.title} » : En attente → Active.`]);
  launched(derby, 9.9);
  acts.push([3, "🏢", `${hoggar.name} s'est inscrit (agence).`]);
  const soirees = db.campaigns.find((c) => c.ownerId === hoggar.id)!;
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
  for (const a of db.social) if (a.verifiedAt !== null) acts.push([(Date.now() - a.verifiedAt) / 86_400_000, "🛡️", `${userOf(a.userId).name} a vérifié son compte ${a.platform} @${a.handle}.`]);

  let i = 0, tracked = 0, sketchId = "";
  const lastRun = Date.now() - 2 * 3_600_000, earningMs = DEFAULT_SETTINGS.earningDays * 86_400_000;
  for (const p of pubs) {
    // Un lien TikTok nomme le compte : celui que le clipper a vérifié.
    const id = newId(), host = ({ TikTok: `www.tiktok.com/${p.u.handles.tiktok}/video/`, Instagram: "www.instagram.com/reel/", Facebook: "www.facebook.com/reel/" } as Record<string, string>)[p.platform] ?? "youtu.be/";
    const paid = p.status === "Validée" ? payoutFor(p.views, p.c) : 0;
    // Suivi : jusqu'au dernier relevé, jusqu'au refus, ou jusqu'à la fin de la fenêtre de gains d'un clip validé.
    const createdAt = daysAgo(p.days + 1), decidedAt = daysAgo(p.days);
    const endAt = p.status === "Refusée" ? decidedAt : Math.min(lastRun, p.status === "Validée" ? decidedAt + earningMs : Infinity);
    if (endAt === lastRun) tracked++;
    const snaps = simulatedHistory(id, createdAt, endAt, p.views, { likeRate: p.likeRate, spike: p.spike }), last = snaps.at(-1);
    const social = db.social.find((a) => a.userId === p.u.id && a.platform === p.platform && a.status === "verified");
    const risk = clipRisk({ createdAt, views: p.views, likes: last?.likes ?? null }, snaps, { userCreatedAt: p.u.createdAt, socialVerifiedAt: social?.verifiedAt ?? null });
    insertPublication(db, {
      id, userId: p.u.id, campaignId: p.c.id, title: p.title, platform: p.platform, url: p.url ?? `https://${host}demo${++i}`, batch: p.batch ?? null, views: p.views, status: p.status, reason: p.reason ?? null, paid,
      approvedAt: p.status === "Validée" ? decidedAt : null, createdAt, likes: last?.likes ?? null, checkedAt: last?.at ?? null, riskScore: risk.score, riskFlags: risk.flags,
    });
    for (const x of snaps) db.snapshots.push({ publicationId: id, day: x.day, views: x.views, likes: x.likes, recordedAt: x.at });
    const txId = newId();
    if (paid) {
      insertTransaction(db, { id: txId, ref: newRef(), userId: p.u.id, type: "gain", label: p.c.title, amount: paid, status: "Validé", availableAt: daysAgo(p.days - 3), publicationId: id, createdAt: daysAgo(p.days) });
      p.c.spent += paid;
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
  // Semaine écoulée du classement déjà clôturée (comme par closeWeek) : primes versées en gains, notifications, journal.
  const lastWeek = demoLastWeek({
    now: Date.now(), clips: db.publications, prizes: DEFAULT_SETTINGS.weeklyPrizes, clippers: db.users.filter((u) => u.role === "clipper"),
    readings: db.snapshots.map((x) => ({ publicationId: x.publicationId, views: x.views, at: x.recordedAt })),
  });
  const closedDays = (Date.now() - lastWeek.closedAt) / 86_400_000;
  let prizeCount = 0, prizeTotal = 0;
  for (const a of lastWeek.awards) {
    const txId = a.prize > 0 ? newId() : null;
    if (txId) {
      insertTransaction(db, { id: txId, ref: newRef(), userId: a.userId, type: "gain", label: prizeLabel(lastWeek.week, a.rank), amount: a.prize, status: "Validé", availableAt: lastWeek.closedAt + DEFAULT_SETTINGS.holdDays * 86_400_000, createdAt: lastWeek.closedAt });
      notes.push([userOf(a.userId), closedDays, "🏆", prizeNotice(lastWeek.week, a.rank, a.prize), link.clipperTx(txId)]);
      prizeCount++;
      prizeTotal += a.prize;
    }
    db.weeklyAwards.push({ week: lastWeek.week, rank: a.rank, userId: a.userId, views: a.views, amount: a.prize, transactionId: txId, createdAt: lastWeek.closedAt });
  }
  acts.push([closedDays, "🏆", weekClosedText(lastWeek.week, prizeCount, prizeTotal)]);
  // Recours en attente : Lina conteste le refus de « Sketch du marché » (musique libre de droits), capture d'écran à l'appui.
  const appealId = newId();
  db.appeals.push({ id: appealId, publicationId: sketchId, userId: lina.id, message: DEMO_APPEAL_MESSAGE, proof: DEMO_PROOF_DATA_URL, status: "En attente", decisionNote: null, decidedBy: null, decidedAt: null, createdAt: daysAgo(0.6) });
  acts.push([0.6, "⚖️", `${lina.name} a contesté le refus du clip « Sketch du marché ».`]);
  // Dernier relevé automatique des vues (toutes les 6 heures, simulé) : le prochain sera lancé à l'ouverture de l'app dans 4 heures.
  db.jobRuns.push({ name: "views", lastRunAt: lastRun, summary: { by: "cron", total: tracked, updated: tracked, simulated: tracked, failed: 0 } });
  // Dernière semaine clôturée du classement (tâche « weekly ») : la semaine écoulée.
  db.jobRuns.push({ name: "weekly", lastRunAt: lastWeek.closedAt, summary: { week: lastWeek.week, winners: prizeCount, paid: prizeTotal } });
  const withdrawalId = newId(), rechargeId = newId();
  insertTransaction(db, { id: withdrawalId, ref: newRef(), userId: amira.id, type: "retrait", label: "Retrait vers BaridiMob", amount: -2000, status: "En cours", method: "BaridiMob", createdAt: daysAgo(1) });
  const rechargeRef = newRef();
  insertTransaction(db, { id: rechargeId, ref: rechargeRef, userId: hoggar.id, type: "recharge", label: "Recharge par virement bancaire", amount: 600000, status: "En cours", method: "virement bancaire", createdAt: daysAgo(1) });
  const admin = db.users[0];
  // Recharge payée en ligne par carte Edahabia (Chargily Pay), validée automatiquement par le webhook.
  const onlineId = newId(), onlineRef = newRef();
  insertTransaction(db, { id: onlineId, ref: onlineRef, userId: tassili.id, type: "recharge", label: "Recharge par carte Edahabia", amount: 300000, status: "Validé", method: "carte Edahabia", provider: "chargily", providerRef: newId(26), createdAt: daysAgo(11) });
  notes.push([tassili, 11, "✅", `Votre recharge de ${fmt(300000)} a été validée.`, link.agencyBudget(onlineId)],
    [admin, 11, "💳", `${tassili.name} a payé en ligne une recharge de ${fmt(300000)} par carte Edahabia (réf. ${onlineRef}).`, link.adminPayment(onlineId)]);
  acts.push([11, "💳", `Recharge de ${fmt(300000)} payée en ligne par ${tassili.name} (carte Edahabia, Chargily).`]);
  // Recharge par virement de Djurdjura confirmée par l'équipe, et retrait de Yacine versé : avec la recharge Edahabia,
  // chacun a son document (factures FAC-…, reçu REC-…), numérotés dans l'ordre des dates comme par la migration 0007.
  const transferId = newId(), payoutId = newId();
  insertTransaction(db, { id: transferId, ref: newRef(), userId: djurdjura.id, type: "recharge", label: "Recharge par virement bancaire", amount: 500000, status: "Validé", method: "virement bancaire", createdAt: daysAgo(8.2) });
  insertTransaction(db, { id: payoutId, ref: newRef(), userId: yacine.id, type: "retrait", label: "Retrait vers CCP", amount: -4000, status: "Validé", method: "CCP", createdAt: daysAgo(4.2) });
  // Premier retrait de Karim, filleul de Yacine, versé : son reçu, et la prime de parrainage payée à Yacine (en rétention).
  const karimPayoutId = newId(), bonusId = newId(), kp = DEMO_REFEREE_PAYOUT, bonus = DEFAULT_SETTINGS.referralBonus;
  insertTransaction(db, { id: karimPayoutId, ref: newRef(), userId: karim.id, type: "retrait", label: `Retrait vers ${kp.method}`, amount: -kp.amount, status: "Validé", method: kp.method, createdAt: daysAgo(kp.requestedDaysAgo) });
  insertTransaction(db, { id: bonusId, ref: newRef(), userId: yacine.id, type: "gain", label: referralLabel(karim.name), amount: bonus, status: "Validé", availableAt: daysAgo(kp.paidDaysAgo - DEFAULT_SETTINGS.holdDays), createdAt: daysAgo(kp.paidDaysAgo) });
  db.referralRewards.push({ refereeId: karim.id, referrerId: yacine.id, amount: bonus, transactionId: bonusId, createdAt: daysAgo(kp.paidDaysAgo) });
  notes.push([karim, kp.paidDaysAgo, "✅", `Votre retrait de ${fmt(kp.amount)} a été validé.`, link.clipperTx(karimPayoutId)], [yacine, kp.paidDaysAgo, "🎁", referralNotice(karim.name, bonus), link.clipperTx(bonusId)]);
  acts.push([kp.requestedDaysAgo, "💸", `${karim.name} a demandé un retrait de ${fmt(kp.amount)}.`], [kp.paidDaysAgo, "✅", `Retrait de ${fmt(kp.amount)} validé par Équipe ClipBoost.`], [kp.paidDaysAgo, "🎁", referralPaidText(yacine.name, karim.name, bonus)]);
  const docs = [
    { kind: "facture" as const, transactionId: onlineId, userId: tassili.id, amount: 300000, createdAt: daysAgo(11) },
    { kind: "facture" as const, transactionId: transferId, userId: djurdjura.id, amount: 500000, createdAt: daysAgo(8) },
    { kind: "recu" as const, transactionId: payoutId, userId: yacine.id, amount: 4000, createdAt: daysAgo(4) },
    { kind: "recu" as const, transactionId: karimPayoutId, userId: karim.id, amount: kp.amount, createdAt: daysAgo(kp.paidDaysAgo) },
  ];
  const numbers = numberDocuments(docs.map((d) => ({ kind: d.kind, at: d.createdAt })));
  for (const [k, d] of docs.entries()) db.documents.push({ id: newId(), number: numbers[k], ...d });
  notes.push([djurdjura, 8, "✅", `Votre recharge de ${fmt(500000)} a été validée.`, link.agencyBudget(transferId)], [yacine, 4, "✅", `Votre retrait de ${fmt(4000)} a été validé.`, link.clipperTx(payoutId)]);
  acts.push([8, "✅", `Recharge de ${fmt(500000)} validée par Équipe ClipBoost.`], [4.2, "💸", `${yacine.name} a demandé un retrait de ${fmt(4000)}.`], [4, "✅", `Retrait de ${fmt(4000)} validé par Équipe ClipBoost.`]);
  acts.push([1, "💸", `${amira.name} a demandé un retrait de ${fmt(2000)}.`]);
  notes.push([admin, 2, "🏢", `${hoggar.name} a soumis la campagne « ${soirees.title} ».`, link.adminCampaign(soirees.id)], [admin, 1, "💸", `${amira.name} demande un retrait de ${fmt(2000)}.`, link.adminPayment(withdrawalId)],
    [admin, 0.9, "🏦", `${hoggar.name} annonce une recharge de ${fmt(600000)} par virement bancaire (réf. ${rechargeRef}).`, link.adminPayment(rechargeId)],
    [admin, 1.5, "🛡️", `${hoggar.name} demande le badge de vérification.`, link.adminUser(hoggar.id)],
    [admin, 0.6, "⚖️", `${lina.name} conteste le refus du clip « Sketch du marché ».`, link.adminAppeal(appealId)]);
  // Conversations de campagne (lib/server/demo-messages.ts) : messages et notifications lus ou non selon la conversation.
  const threads = demoThreads({ yacine, amira, lina, tassili, admin, derby, kahwa, rire });
  for (const m of threads.messages) db.messages.push({ id: newId(), campaignId: m.campaignId, clipperId: m.clipperId, senderId: m.senderId, body: m.body, readAt: m.read ? daysAgo(m.days - 0.05) : null, createdAt: daysAgo(m.days) });
  for (const n of threads.notes) for (const to of n.to === "admins" ? db.users.filter((u) => u.role === "admin").map((u) => u.id) : [n.to]) {
    db.notifications.push({ id: newId(), userId: to, icon: "💬", text: n.text, link: n.link, read: n.read, createdAt: daysAgo(n.days) });
  }
  // Les événements de plus de 2 jours sont déjà lus ; les plus récents restent à lire.
  // Académie : les cinq leçons de départ (comme la migration 0011), et une leçon en brouillon (français seul) rangée en dernier.
  db.lessons = starterLessons(daysAgo(30));
  db.lessons.push({ ...structuredClone(DEMO_DRAFT_LESSON), position: db.lessons.length + 1, createdAt: daysAgo(0.5), updatedAt: daysAgo(0.5) });
  acts.push([0.5, "🎓", lessonCreatedText(DEMO_DRAFT_LESSON.title.fr, "Équipe ClipBoost", false)]);
  for (const [days, icon, text] of acts) db.activity.push({ id: newId(), icon, text, createdAt: daysAgo(days) });
  for (const [u, days, icon, text, href] of notes) db.notifications.push({ id: newId(), userId: u.id, icon, text, link: href, read: days > 2, createdAt: daysAgo(days) });
  return db;
}
