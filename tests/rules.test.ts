import assert from "node:assert/strict";
import { test } from "node:test";
import {
  belowMin, bioHasCode, clipRisk, dailyGains, fraudRisk, fundingCost, handleInUrl, instantFee, normalizeHandle, payoutDelta, payoutFor, RISK_LOW_LIKES, RISK_NEW_ACCOUNT,
  RISK_SPIKE, RISK_WINDOW_DAYS, riskLevel, sentence, simulatedHistory, simulatedProfile, simulatedStats, socialCode, socialLinkError, utcDay, validateCampaignNumbers, viewsFor, viewsTrackedText,
} from "../lib/server/rules";

const derby = { rate: 150, minPayout: 300, maxPayout: 30000 };

test("un clip sous le seuil ne rapporte rien", () => {
  assert.equal(belowMin(1999, derby), true);
  assert.equal(payoutFor(1999, derby), 0);
  assert.equal(payoutFor(2000, derby), 300);
});

test("les gains s'arrêtent au plafond", () => {
  assert.equal(payoutFor(48200, derby), 7230);
  assert.equal(payoutFor(5_000_000, derby), 30000);
});

test("vues nécessaires pour un montant", () => {
  assert.equal(viewsFor(300, 150), 2000);
  assert.equal(viewsFor(30000, 150), 200000);
});

test("la commission s'ajoute au budget", () => {
  assert.equal(fundingCost(200000, 15), 230000);
  assert.equal(fundingCost(0, 15), 0);
});

test("frais du retrait instantané avec minimum", () => {
  assert.equal(instantFee(2000, 2, 100), 100);
  assert.equal(instantFee(20000, 2, 100), 400);
});

test("les vues supplémentaires sont payées sans dépasser le budget", () => {
  const c = { ...derby, budget: 10000, spent: 9000 };
  assert.equal(payoutDelta(48200, c, 7230), 0);
  assert.equal(payoutDelta(60000, { ...c, spent: 0 }, 7230), 1770);
  assert.equal(payoutDelta(200000, c, 7230), 1000);
});

test("validation des montants d'une campagne", () => {
  assert.equal(validateCampaignNumbers({ rate: 150, budget: 40000, minPayout: 300, maxPayout: 3000 }, 50000), "Le budget minimum est de 50000 DA");
  assert.match(validateCampaignNumbers({ rate: 150, budget: 60000, minPayout: 300, maxPayout: 300 }, 50000) ?? "", /supérieur/);
  assert.match(validateCampaignNumbers({ rate: 150, budget: 60000, minPayout: 300, maxPayout: 70000 }, 50000) ?? "", /dépasser le budget/);
  assert.equal(validateCampaignNumbers({ rate: 150, budget: 60000, minPayout: 300, maxPayout: 30000 }, 50000), null);
});

test("motif d'un refus cité avec un seul signe final", () => {
  assert.equal(sentence("Logo officiel manquant"), "Logo officiel manquant.");
  assert.equal(sentence("Logo officiel manquant."), "Logo officiel manquant.");
  assert.equal(sentence("Dates absentes !"), "Dates absentes !");
});

test("comptes sociaux : code CB-XXXX, identifiant normalisé, code cherché dans la bio", () => {
  assert.equal(socialCode([0, 31, 32, 255]), "CB-A9A9");
  assert.match(socialCode([7, 100, 200, 13]), /^CB-[A-HJ-NP-Z2-9]{4}$/);
  assert.equal(normalizeHandle("TikTok", "  @Yacine.Clips "), "yacine.clips");
  assert.equal(normalizeHandle("TikTok", "https://www.tiktok.com/@Yacine.Clips?lang=fr"), "yacine.clips");
  assert.equal(normalizeHandle("YouTube", "youtube.com/@YacineClips/shorts"), "yacineclips");
  assert.equal(normalizeHandle("Instagram", "https://instagram.com/amira.style/"), "amira.style");
  assert.equal(normalizeHandle("Facebook", "https://www.facebook.com/TassiliSport"), "tassilisport");
  assert.equal(normalizeHandle("YouTube", "@قناة_ياسين"), "قناة_ياسين");
  for (const bad of ["", "@", "yacine clips", "https://www.instagram.com/reel/abc", "https://www.evil.com/@a/video/1", "<script>"]) {
    assert.equal(normalizeHandle(bad.includes("instagram") ? "Instagram" : "TikTok", bad), null, bad);
  }
  assert.equal(normalizeHandle("Instagram", "https://www.tiktok.com/@amira"), null, "adresse d'une autre plateforme");
  assert.equal(bioHasCode("Monteur foot ⚽ CB-7F3K", "CB-7F3K"), true);
  assert.equal(bioHasCode("code : cb-7f3k.", "CB-7F3K"), true);
  assert.equal(bioHasCode("CB-7F3KX", "CB-7F3K"), false);
  assert.equal(bioHasCode("", "CB-7F3K"), false);
});

test("clip accepté seulement depuis le compte vérifié de sa plateforme", () => {
  assert.equal(handleInUrl("TikTok", "https://www.tiktok.com/@Yacine.Clips/video/123"), "yacine.clips");
  assert.equal(handleInUrl("YouTube", "https://www.youtube.com/@yacineclips/shorts/abc"), "yacineclips");
  assert.equal(handleInUrl("YouTube", "https://youtube.com/shorts/abc"), null);
  assert.equal(handleInUrl("TikTok", "https://vm.tiktok.com/ZM123/"), null);
  assert.equal(handleInUrl("Instagram", "https://www.instagram.com/@x/reel/1"), null);
  assert.equal(socialLinkError("TikTok", "https://www.tiktok.com/@yacine.clips/video/1", undefined), "Vérifiez d'abord votre compte TikTok (Profil → Comptes sociaux)");
  assert.equal(socialLinkError("TikTok", "https://www.tiktok.com/@yacine.clips/video/1", "yacine.clips"), null);
  assert.equal(socialLinkError("TikTok", "https://www.tiktok.com/@autre/video/1", "yacine.clips"), "Ce lien ne vient pas de votre compte TikTok vérifié (@yacine.clips)");
  assert.equal(socialLinkError("YouTube", "https://youtu.be/abc", "yacineclips"), null);
  assert.equal(socialLinkError("Instagram", "https://www.instagram.com/reel/abc", "amira.style"), null);
});

// ---------- Relevé des vues et score de risque de fraude ----------

const pt = (day: string, views: number, likes: number | null = null) => ({ day, views, likes });

test("vues gagnées par jour : écart entre relevés, jours manquants répartis, premier jour", () => {
  const h = [pt("2026-03-03", 9000), pt("2026-03-01", 1000), pt("2026-03-02", 3000)];
  assert.deepEqual(dailyGains(h).map((x) => [x.day, x.gain]), [["2026-03-01", null], ["2026-03-02", 2000], ["2026-03-03", 6000]]);
  // Publié la veille du premier relevé : ses vues sont réparties sur deux jours. Deux jours sans relevé : gain moyen.
  assert.deepEqual(dailyGains([pt("2026-03-02", 1000), pt("2026-03-05", 4000)], "2026-03-01").map((x) => x.gain), [500, 1000]);
  // Vues en baisse (correction de la plateforme) : aucun gain négatif.
  assert.equal(dailyGains([pt("2026-03-01", 5000), pt("2026-03-02", 4000)])[1].gain, 0);
});

test("score de risque : pic soudain, peu de likes, compte récent, plafond et niveaux", () => {
  const steady = [pt("2026-03-01", 1000), pt("2026-03-02", 2000), pt("2026-03-03", 3100), pt("2026-03-04", 4000)];
  const calm = fraudRisk({ history: steady, views: 4000, likes: 200, accountAgeDays: 90 });
  assert.deepEqual(calm, { score: 0, flags: [] });
  // Pic : 26 000 vues en un jour contre ~1 000 par jour avant (plus de 5 fois, plus de 5 000).
  const spiky = [...steady, pt("2026-03-05", 30000)];
  assert.deepEqual(fraudRisk({ history: spiky, views: 30000, likes: 1500, accountAgeDays: 90 }), { score: 45, flags: [RISK_SPIKE] });
  // Le pic reste signalé les jours suivants (même s'ils sont calmes), tant qu'il est dans l'historique fourni.
  assert.deepEqual(fraudRisk({ history: [...spiky, pt("2026-03-06", 30500)], views: 30500, likes: 1500, accountAgeDays: 90 }).flags, [RISK_SPIKE]);
  // Gain plus de 5 fois la moyenne mais sous 5 000 vues : pas de pic.
  assert.deepEqual(fraudRisk({ history: [pt("2026-03-01", 100), pt("2026-03-02", 200), pt("2026-03-03", 4000)], views: 4000, likes: 200, accountAgeDays: 90 }).flags, []);
  // Premier jour énorme (jour de publication connu).
  assert.deepEqual(fraudRisk({ history: [pt("2026-03-01", 80000)], views: 80000, likes: 4000, accountAgeDays: 90, publishedDay: "2026-03-01" }).flags, [RISK_SPIKE]);
  // Premier relevé dix jours après la publication (clip suivi après coup) : 600 000 vues en dix jours, pas un pic.
  assert.deepEqual(fraudRisk({ history: [pt("2026-03-11", 600000)], views: 600000, likes: 30000, accountAgeDays: 90, publishedDay: "2026-03-01" }).flags, []);
  // Peu de likes : à partir de 5 000 vues, moins de 0,5 % ; likes inconnus : jamais signalé.
  assert.deepEqual(fraudRisk({ history: [], views: 10000, likes: 49, accountAgeDays: 90 }), { score: 35, flags: [RISK_LOW_LIKES] });
  assert.deepEqual(fraudRisk({ history: [], views: 10000, likes: 50, accountAgeDays: 90 }).flags, []);
  assert.deepEqual(fraudRisk({ history: [], views: 4999, likes: 0, accountAgeDays: 90 }).flags, []);
  assert.deepEqual(fraudRisk({ history: [], views: 10000, likes: null, accountAgeDays: 90 }).flags, []);
  // Compte récent : compte ClipBoost, ou compte social vérifié, de moins de 7 jours.
  assert.deepEqual(fraudRisk({ history: [], views: 0, likes: null, accountAgeDays: 3 }), { score: 20, flags: [RISK_NEW_ACCOUNT] });
  assert.deepEqual(fraudRisk({ history: [], views: 0, likes: null, accountAgeDays: 90, socialAgeDays: 2 }).flags, [RISK_NEW_ACCOUNT]);
  assert.deepEqual(fraudRisk({ history: [], views: 0, likes: null, accountAgeDays: 90, socialAgeDays: 30 }).flags, []);
  // Les trois signaux : 45 + 35 + 20 = 100, plafonné à 100.
  const all = fraudRisk({ history: spiky, views: 30000, likes: 20, accountAgeDays: 1 });
  assert.deepEqual(all, { score: 100, flags: [RISK_SPIKE, RISK_LOW_LIKES, RISK_NEW_ACCOUNT] });
  assert.equal(riskLevel(0), "faible");
  assert.equal(riskLevel(29), "faible");
  assert.equal(riskLevel(35), "moyen");
  assert.equal(riskLevel(59), "moyen");
  assert.equal(riskLevel(60), "élevé");
  assert.equal(riskLevel(all.score), "élevé");
});

test("risque d'un clip : âges à l'envoi, jour de publication seulement si l'historique est complet", () => {
  const sent = Date.parse("2026-03-01T10:00:00Z"), day = 86_400_000;
  const accounts = { userCreatedAt: sent - 2 * day, socialVerifiedAt: null };
  // Compte de 2 jours à l'envoi ; un premier relevé de 80 000 vues le jour même : pic.
  assert.deepEqual(clipRisk({ createdAt: sent, views: 80000, likes: 4000 }, [pt("2026-03-01", 80000, 4000)], accounts),
    { score: 65, flags: [RISK_SPIKE, RISK_NEW_ACCOUNT] });
  // Historique plus long que la fenêtre : le premier relevé gardé n'est qu'une base (pas de faux pic au premier jour).
  const long = Array.from({ length: RISK_WINDOW_DAYS + 2 }, (_, i) => pt(utcDay(sent + i * day), 80000 + i * 1000, 5000));
  assert.deepEqual(clipRisk({ createdAt: sent, views: long.at(-1)!.views, likes: 5000 }, long, { userCreatedAt: sent - 90 * day, socialVerifiedAt: sent - 3 * day }).flags, [RISK_NEW_ACCOUNT]);
  // Compte social vérifié après l'envoi du clip : ignoré.
  assert.deepEqual(clipRisk({ createdAt: sent, views: 0, likes: null }, [], { userCreatedAt: null, socialVerifiedAt: sent + day }).flags, []);
});

test("mode simulé : croissance déterministe, rapide puis plus lente, jamais en baisse ; likes de 3 à 8 %", () => {
  const id = "p_demo";
  assert.deepEqual(simulatedStats(id, 30, { views: 0, likes: null, lastAgeHours: null }), simulatedStats(id, 30, { views: 0, likes: null, lastAgeHours: null }));
  // Relevé toutes les 6 heures pendant 10 jours.
  let last = { views: 0, likes: null as number | null, lastAgeHours: null as number | null };
  const gains: number[] = [];
  for (let h = 6; h <= 240; h += 6) {
    const s = simulatedStats(id, h, last);
    assert.ok(s.views >= last.views, "les vues ne baissent jamais");
    gains.push(s.views - last.views);
    last = { views: s.views, likes: s.likes, lastAgeHours: h };
  }
  const firstDay = gains.slice(0, 4).reduce((a, b) => a + b, 0), lastDay = gains.slice(-4).reduce((a, b) => a + b, 0);
  assert.ok(firstDay > lastDay * 3, `ralentissement attendu (${firstDay} puis ${lastDay})`);
  const { reach, likeRate } = simulatedProfile(id);
  assert.ok(reach >= 3000 && reach <= 60000 && likeRate >= 0.03 && likeRate <= 0.08);
  assert.ok(last.likes! / last.views >= 0.025 && last.likes! / last.views <= 0.085);
  // Un clip déjà relevé repart de ses vues ; des likes inconnus sont estimés sur toutes les vues.
  const next = simulatedStats(id, 60, { views: 20000, likes: null, lastAgeHours: 54 });
  assert.ok(next.views >= 20000 && next.views < 30000);
  assert.ok(next.likes >= next.views * 0.03 && next.likes <= next.views * 0.08);
});

test("historique simulé des données d'exemple : un relevé par jour jusqu'au dernier, pic sur demande", () => {
  const created = Date.parse("2026-03-01T08:00:00Z"), end = Date.parse("2026-03-05T15:00:00Z");
  const h = simulatedHistory("p_x", created, end, 12000);
  assert.deepEqual(h.map((x) => x.day), ["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05"]);
  assert.equal(h.at(-1)!.views, 12000);
  assert.equal(h.at(-1)!.at, end);
  assert.ok(h.every((x, i) => i === 0 || x.views >= h[i - 1].views));
  const spike = simulatedHistory("p_x", created, end, 50000, { spike: true, likeRate: 0.001 });
  assert.equal(fraudRisk({ history: spike, views: 50000, likes: spike.at(-1)!.likes, accountAgeDays: 90 }).score, 80);
  assert.equal(viewsTrackedText("Admin", 1, 0), "Vues relevées par Admin : 1 clip mis à jour.");
  assert.equal(viewsTrackedText("Admin", 7, 2), "Vues relevées par Admin : 7 clips mis à jour, 2 en erreur.");
});
