// Données de démarrage de la version autonome : le compte administrateur et les mêmes
// données d'exemple que `scripts/seed.mts --demo`, datées par rapport au premier lancement.
import type { CampaignStatus, PublicationStatus } from "../../lib/server/db/schema";
import { payoutFor } from "../../lib/server/rules";
import { link } from "../../lib/server/links";
import { DEFAULT_SETTINGS } from "../../lib/server/settings";
import { emptyStore, insertCampaign, insertPublication, insertTransaction, insertUser, newId, newRef, type CampaignRow, type Store, type UserRow } from "./db";
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
  const yacine = await U("clipper", "Yacine Benali", "yacine@clipboost.dz", { level: "Clipper Argent", bio: "Monteur passionné de foot et d'humour.", handles: { tiktok: "@yacine.clips" }, payoutMethod: "CCP", payoutAccount: "0021234567 clé 89", createdAt: daysAgo(210) });
  const amira = await U("clipper", "Amira Khelifi", "amira@clipboost.dz", { level: "Clipper Or", bio: "Lifestyle et mode à Oran.", handles: { instagram: "@amira.style" }, payoutMethod: "BaridiMob", payoutAccount: "00799999001234567890", createdAt: daysAgo(190) });
  const lina = await U("clipper", "Lina Mansouri", "lina@clipboost.dz", { level: "Clipper Bronze", handles: { tiktok: "@lina.lol" }, createdAt: daysAgo(60) });
  const tassili = await U("agence", "Tassili Sport", "agence@clipboost.dz", { contact: "Nassim Ait Ali", credit: 400000, createdAt: daysAgo(240) });
  const hoggar = await U("agence", "Hoggar Boissons", "hoggar@clipboost.dz", { contact: "Meriem Saadi", credit: 0, createdAt: daysAgo(3) });

  const C = (ownerId: string | null, title: string, brand: string, category: string, rate: number, budget: number, status: CampaignStatus, emoji: string, gradient: string, platforms: string[], rules: string[], extra: Partial<CampaignRow> = {}) =>
    insertCampaign(db, { id: newId(), ownerId, title, brand, category, rate, budget, status, emoji, gradient, platforms, rules, minPayout: rate * 2, maxPayout: rate * 200, commissionRate: ownerId ? 15 : 0, reserved: ownerId && status !== "En attente" ? Math.round(budget * 1.15) : 0, ...extra });
  const derby = C(tassili.id, "Derby Algérois", "Tassili Sport", "Sport", 150, 600000, "Active", "⚽", "from-emerald-400 via-teal-500 to-cyan-600", ["TikTok", "Instagram", "YouTube"], ["Clip de 15 à 60 secondes", "Mentionner @tassilisport", "Pas de musique protégée"], { top: true, createdAt: daysAgo(10) });
  C(tassili.id, "Nouveau maillot 2027", "Tassili Sport", "Sport", 140, 300000, "En pause", "👕", "from-emerald-500 via-green-600 to-teal-700", ["Instagram", "TikTok"], ["Porter le maillot à l'écran", "Mentionner @tassilisport"], { createdAt: daysAgo(27) });
  C(hoggar.id, "Spécial Soirées d'Été", "Hoggar Boissons", "Food", 135, 500000, "En attente", "🥤", "from-cyan-300 via-sky-500 to-blue-600", ["TikTok", "Instagram"], ["Montrer la bouteille", "Ambiance soirée entre amis"], { createdAt: daysAgo(2) });
  const kahwa = C(null, "Kahwa du matin", "Kahwa Lounge", "Food", 110, 250000, "Active", "☕", "from-amber-300 via-orange-400 to-rose-500", ["TikTok", "Instagram"], ["Montrer le produit dans les 3 premières secondes", "Ajouter #KahwaDuMatin"], { createdAt: daysAgo(14) });
  const rire = C(null, "Les Sketchs du Bled", "Studio Numidia", "Humour", 125, 220000, "Active", "😂", "from-rose-400 via-pink-500 to-purple-600", ["TikTok", "YouTube"], ["Humour bienveillant", "Mentionner @studionumidia"], { maxPayout: 6000, createdAt: daysAgo(20) });

  const join = (u: UserRow, c: CampaignRow, favorite = false) => db.members.push({ campaignId: c.id, userId: u.id, joined: true, favorite, createdAt: Date.now() });
  join(yacine, derby, true); join(yacine, kahwa); join(yacine, rire, true); join(amira, kahwa); join(amira, derby); join(lina, rire);

  // Clips : certains validés et payés, d'autres en attente (dont un sous le seuil).
  const pubs: { u: UserRow; c: CampaignRow; title: string; platform: string; views: number; status: PublicationStatus; days: number; reason?: string }[] = [
    { u: yacine, c: derby, title: "But de la 89e en slow-motion", platform: "TikTok", views: 48200, status: "Validée", days: 2 },
    { u: yacine, c: rire, title: "Le taxi clandestin", platform: "TikTok", views: 63400, status: "Validée", days: 8 },
    { u: yacine, c: kahwa, title: "Mon café du matin à Alger", platform: "TikTok", views: 9800, status: "Validée", days: 6 },
    { u: amira, c: kahwa, title: "Brunch à Oran", platform: "Instagram", views: 18800, status: "Validée", days: 5 },
    { u: amira, c: derby, title: "Ambiance des tribunes", platform: "Instagram", views: 31200, status: "En attente", days: 1 },
    { u: lina, c: rire, title: "Quand ta mère trouve ton bulletin", platform: "TikTok", views: 52900, status: "En attente", days: 1 },
    { u: yacine, c: derby, title: "Les supporters chantent", platform: "YouTube", views: 1600, status: "En attente", days: 0 },
    { u: lina, c: rire, title: "Sketch du marché", platform: "YouTube", views: 4100, status: "Refusée", days: 9, reason: "Musique protégée" },
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

  let i = 0;
  for (const p of pubs) {
    const id = newId(), host = p.platform === "TikTok" ? "www.tiktok.com/@clip/video/" : p.platform === "Instagram" ? "www.instagram.com/reel/" : "youtu.be/";
    const paid = p.status === "Validée" ? payoutFor(p.views, p.c) : 0;
    insertPublication(db, { id, userId: p.u.id, campaignId: p.c.id, title: p.title, platform: p.platform, url: `https://${host}demo${++i}`, views: p.views, status: p.status, reason: p.reason ?? null, paid, approvedAt: p.status === "Validée" ? daysAgo(p.days) : null, createdAt: daysAgo(p.days + 1) });
    const txId = newId();
    if (paid) {
      insertTransaction(db, { id: txId, ref: newRef(), userId: p.u.id, type: "gain", label: p.c.title, amount: paid, status: "Validé", availableAt: daysAgo(p.days - 3), publicationId: id, createdAt: daysAgo(p.days) });
      p.c.spent += paid;
    }
    acts.push([p.days + 1, "🎬", `${p.u.name} a soumis le clip « ${p.title} » (${p.c.title}).`]);
    if (paid) {
      acts.push([p.days, "✅", `Clip « ${p.title} » validé (${fmt(paid)}).`]);
      notes.push([p.u, p.days, "💸", `+${fmt(paid)} pour « ${p.title} ». Retirable dans ${DEFAULT_SETTINGS.holdDays} jours.`, link.clipperTx(txId)]);
    } else if (p.status === "Refusée") {
      acts.push([p.days, "🚫", `Clip « ${p.title} » refusé par Équipe ClipBoost.`]);
      notes.push([p.u, p.days, "⚠️", `Clip « ${p.title} » refusé : ${p.reason}.`, link.clip(id)]);
    }
  }
  const withdrawalId = newId(), rechargeId = newId();
  insertTransaction(db, { id: withdrawalId, ref: newRef(), userId: amira.id, type: "retrait", label: "Retrait vers BaridiMob", amount: -2000, status: "En cours", method: "BaridiMob", createdAt: daysAgo(1) });
  const rechargeRef = newRef();
  insertTransaction(db, { id: rechargeId, ref: rechargeRef, userId: hoggar.id, type: "recharge", label: "Recharge par virement bancaire", amount: 600000, status: "En cours", method: "virement bancaire", createdAt: daysAgo(1) });
  const admin = db.users[0];
  acts.push([1, "💸", `${amira.name} a demandé un retrait de ${fmt(2000)}.`]);
  notes.push([admin, 2, "🏢", `${hoggar.name} a soumis la campagne « ${soirees.title} ».`, link.adminCampaign(soirees.id)], [admin, 1, "💸", `${amira.name} demande un retrait de ${fmt(2000)}.`, link.adminPayment(withdrawalId)],
    [admin, 0.9, "🏦", `${hoggar.name} annonce une recharge de ${fmt(600000)} par virement bancaire (réf. ${rechargeRef}).`, link.adminPayment(rechargeId)]);
  // Les événements de plus de 2 jours sont déjà lus ; les plus récents restent à lire.
  for (const [days, icon, text] of acts) db.activity.push({ id: newId(), icon, text, createdAt: daysAgo(days) });
  for (const [u, days, icon, text, href] of notes) db.notifications.push({ id: newId(), userId: u.id, icon, text, link: href, read: days > 2, createdAt: daysAgo(days) });
  return db;
}
