import assert from "node:assert/strict";
import { test } from "node:test";
import {
  viewRates, belowMin, isTeamCampaign, messageExcerpt, messageThreads, replyText, bioHasCode, clipRisk, dailyGains, fraudRisk, fundingCost, handleInUrl, instantFee, normalizeHandle, payoutDelta, payoutFor, RISK_LOW_LIKES, RISK_NEW_ACCOUNT,
  RISK_SPIKE, RISK_WINDOW_DAYS, riskLevel, sentence, simulatedHistory, simulatedProfile, simulatedStats, socialCode, socialLinkError, utcDay, validateCampaignNumbers, viewsFor, viewsTrackedText,
  acceptedReferrer, normalizeReferralCode, payoutKey, referralCode, referralDecision, referralFirstName, referralLabel, referralNotice, referralRefusedText,
  keepsWeekReading, prizeLabel, prizeNotice, rankText, weekBounds, weekClosedText, weekGains, weekKey, weeklyRanking, weekNumber, weeksToClose, weekStart,
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
  // Premier jour énorme (publication connue ; relevé à midi, 4 heures après : compté pour un jour).
  const published = Date.parse("2026-03-01T08:00:00Z");
  assert.deepEqual(fraudRisk({ history: [pt("2026-03-01", 80000)], views: 80000, likes: 4000, accountAgeDays: 90, publishedAt: published }).flags, [RISK_SPIKE]);
  // Premier relevé dix jours après la publication (clip suivi après coup) : 600 000 vues en dix jours, pas un pic.
  assert.deepEqual(fraudRisk({ history: [pt("2026-03-11", 600000)], views: 600000, likes: 30000, accountAgeDays: 90, publishedAt: published }).flags, []);
  // Jour de publication à peine entamé (publié à 21 h, relevé à 22 h) puis une journée entière : rythme comparable, pas un pic.
  const late = Date.parse("2026-03-01T21:00:00Z"), at = (iso: string) => Date.parse(iso);
  const partial = [{ ...pt("2026-03-01", 2000), at: at("2026-03-01T22:00:00Z") }, { ...pt("2026-03-02", 15000), at: at("2026-03-02T22:00:00Z") }];
  assert.deepEqual(fraudRisk({ history: partial, views: 15000, likes: 600, accountAgeDays: 90, publishedAt: late }).flags, []);
  assert.deepEqual(viewRates(partial, late).map((r) => [r.hours, r.rate]), [[1, 48000], [24, 13000]]);
  // Deux relevés rapprochés (saisie de l'équipe juste avant le relevé automatique) : intervalle compté 6 heures.
  assert.deepEqual(viewRates([{ ...pt("2026-03-01", 1000), at: at("2026-03-01T23:55:00Z") }, { ...pt("2026-03-02", 1500), at: at("2026-03-02T00:05:00Z") }]).map((r) => r.rate), [null, 2000]);
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

test("score des données d'exemple stable à toute heure : un clip ordinaire n'a jamais de pic, le clip suspect toujours", () => {
  const day = 86_400_000, start = Date.parse("2026-03-10T00:00:00Z");
  const clips = [{ views: 48200, days: 2 }, { views: 12500, days: 2 }, { views: 63400, days: 8 }, { views: 9800, days: 6 }, { views: 18800, days: 5 }, { views: 31200, days: 1 }, { views: 1600, days: 0 }];
  // Même suivi que les seeds : dernier relevé 2 heures avant « maintenant », fenêtre de gains de 7 jours pour un clip validé.
  for (let now = start; now < start + day; now += 10 * 60_000) {
    for (const [k, c] of clips.entries()) {
      const createdAt = now - (c.days + 1) * day, endAt = Math.min(now - 2 * 3_600_000, createdAt + day + 7 * day);
      const h = simulatedHistory(`p_${k}`, createdAt, endAt, c.views);
      const r = clipRisk({ createdAt, views: c.views, likes: h.at(-1)!.likes }, h, { userCreatedAt: createdAt - 90 * day, socialVerifiedAt: null });
      assert.deepEqual(r.flags, [], `${new Date(now).toISOString()} clip ${k}`);
    }
    const createdAt = now - 2 * day, h = simulatedHistory("p_suspect", createdAt, now - 2 * 3_600_000, 52900, { spike: true, likeRate: 0.0007 });
    assert.equal(clipRisk({ createdAt, views: 52900, likes: h.at(-1)!.likes }, h, { userCreatedAt: createdAt - 60 * day, socialVerifiedAt: null }).score, 80, new Date(now).toISOString());
  }
});

test("messagerie : extrait des notifications, campagnes de ClipBoost, conversations et non lus", () => {
  assert.equal(messageExcerpt("  Bonjour,\n  une question  "), "Bonjour, une question");
  const long = messageExcerpt("Bonjour, le festival accepte-t-il des extraits sous-titrés en arabe et en français ?");
  assert.ok(long.length <= 61 && long.endsWith("…") && !long.includes(" …"), long);
  assert.equal(replyText(null, "Kahwa", "Oui."), "L'équipe ClipBoost a répondu sur « Kahwa » : « Oui. »");
  assert.deepEqual([isTeamCampaign(null, null), isTeamCampaign("a1", "admin"), isTeamCampaign("a1", "agence")], [true, true, false]);
  const m = (id: string, senderId: string, at: number, readAt: number | null = null) => ({ id, campaignId: "c1", clipperId: "k1", senderId, body: id, createdAt: at, readAt });
  const rows = [m("r", "ag", 2), m("q", "k1", 1, 2), m("q2", "k1", 3), { ...m("o", "k2", 5), clipperId: "k2" }];
  const [other, thread] = messageThreads(rows, false);
  assert.deepEqual([other.id, thread.id, thread.unread, thread.awaiting, thread.messages.map((x) => x.id)], ["c1~k2", "c1~k1", 1, true, ["q", "r", "q2"]]);
  assert.equal(messageThreads(rows, true)[1].unread, 1);
});

// ---------- Classement hebdomadaire (semaines du lundi au dimanche, heure d'Alger : UTC+1 sans heure d'été) ----------

const at = (iso: string) => Date.parse(iso);
const iso = (ms: number) => new Date(ms).toISOString();

test("semaine du classement : lundi 00:00 à dimanche 24:00 heure d'Alger, clé ISO", () => {
  // Dimanche 18 octobre 2026 à 23:59:59 à Alger (22:59:59 UTC) : encore la semaine 42 ; une seconde plus tard, la 43.
  assert.deepEqual([iso(weekStart(at("2026-10-18T22:59:59Z"))), weekKey(at("2026-10-18T22:59:59Z"))], ["2026-10-11T23:00:00.000Z", "2026-W42"]);
  assert.deepEqual([iso(weekStart(at("2026-10-18T23:00:00Z"))), weekKey(at("2026-10-18T23:00:00Z"))], ["2026-10-18T23:00:00.000Z", "2026-W43"]);
  // Lundi 00:30 UTC est déjà lundi 01:30 à Alger ; dimanche 23:30 UTC aussi (lundi 00:30 à Alger).
  assert.equal(weekKey(at("2026-10-19T00:30:00Z")), "2026-W43");
  assert.equal(weekKey(at("2026-10-25T23:30:00Z")), "2026-W44");
  assert.deepEqual(weekBounds("2026-W43"), { start: at("2026-10-18T23:00:00Z"), end: at("2026-10-25T23:00:00Z") });
  assert.equal(weekNumber("2026-W43"), 43);
  // Changement d'année : 2026 a 53 semaines ISO (1er janvier un jeudi), le 1er janvier 2027 est dans la 53e, la
  // semaine 1 de 2027 commence lundi 4 janvier (dimanche 3 à 23:00 UTC). 2025 n'a que 52 semaines.
  assert.equal(weekKey(at("2027-01-01T12:00:00Z")), "2026-W53");
  assert.equal(weekKey(at("2027-01-03T23:00:00Z")), "2027-W01");
  assert.equal(weekKey(at("2025-12-29T10:00:00Z")), "2026-W01");
  assert.deepEqual(weekBounds("2027-W01"), { start: at("2027-01-03T23:00:00Z"), end: at("2027-01-10T23:00:00Z") });
  for (const bad of ["2025-W53", "2026-W00", "2026-W54", "2026-43", "W43", ""]) assert.equal(weekBounds(bad), null, bad);
  // Chaque instant d'une année tombe dans la semaine dont les bornes l'encadrent.
  for (let t = at("2026-01-01T00:00:00Z"); t < at("2027-01-15T00:00:00Z"); t += 3 * 3_600_000 + 17 * 60_000) {
    const b = weekBounds(weekKey(t))!;
    assert.ok(b.start <= t && t < b.end && b.end - b.start === 7 * 86_400_000, iso(t));
  }
});

test("semaines à clôturer : la semaine écoulée, les semaines manquées (8 au plus), rien deux fois", () => {
  const now = at("2026-10-20T10:00:00Z");
  assert.deepEqual(weeksToClose(null, now), ["2026-W42"]);
  assert.deepEqual(weeksToClose("2026-W42", now), []);
  assert.deepEqual(weeksToClose("2026-W43", now), []);
  assert.deepEqual(weeksToClose("2026-W40", now), ["2026-W41", "2026-W42"]);
  assert.deepEqual(weeksToClose("2026-W52", at("2027-01-05T00:00:00Z")), ["2026-W53"]);
  assert.deepEqual(weeksToClose("2026-W20", now), ["2026-W35", "2026-W36", "2026-W37", "2026-W38", "2026-W39", "2026-W40", "2026-W41", "2026-W42"]);
  assert.deepEqual(weeksToClose("n'importe quoi", now), ["2026-W42"]);
  // Lundi 00:10 à Alger (dimanche 23:10 UTC) : la semaine qui vient de finir est due.
  assert.deepEqual(weeksToClose("2026-W41", at("2026-10-18T23:10:00Z")), ["2026-W42"]);
  // Relevé du jour UTC fait avant le début de la semaine : gardé par un relevé fait après (dimanche 23:00-24:00 UTC).
  assert.equal(keepsWeekReading(at("2026-10-18T18:00:00Z"), at("2026-10-18T23:30:00Z")), true);
  assert.equal(keepsWeekReading(at("2026-10-18T12:00:00Z"), at("2026-10-18T18:00:00Z")), false);
  assert.equal(keepsWeekReading(at("2026-10-19T06:00:00Z"), at("2026-10-19T12:00:00Z")), false);
});

test("vues validées de la semaine et classement : écart entre relevés, ex æquo, suspendus, primes du top 10", () => {
  const { start, end } = weekBounds("2026-W43")!;
  const r = (publicationId: string, views: number, when: string) => ({ publicationId, views, at: at(when) });
  const readings = [
    // a : relevés avant, pendant et après la semaine ; le relevé exact du lundi 00:00 à Alger compte dans la semaine.
    r("a", 1000, "2026-10-17T22:00:00Z"), r("a", 1500, "2026-10-18T22:00:00Z"), r("a", 4000, "2026-10-21T22:00:00Z"), r("a", 6000, "2026-10-25T22:00:00Z"), r("a", 9000, "2026-10-26T06:00:00Z"),
    // b : aucun relevé avant la semaine (clip publié pendant) : toutes ses vues comptent.
    r("b", 2500, "2026-10-20T10:00:00Z"),
    r("c", 3000, "2026-10-18T23:00:00Z"), r("c", 5000, "2026-10-22T12:00:00Z"),
    // d : seulement avant la semaine ; e : vues corrigées à la baisse (aucun gain négatif).
    r("d", 7000, "2026-10-10T10:00:00Z"), r("e", 900, "2026-10-17T10:00:00Z"), r("e", 800, "2026-10-20T10:00:00Z"),
  ];
  const gains = weekGains(readings, start, end);
  assert.deepEqual(Object.fromEntries(gains), { a: 4500, b: 2500, c: 5000, d: 0, e: 0 });
  const day = 86_400_000;
  const clips = [
    { id: "a", userId: "u1", status: "Validée" }, { id: "b", userId: "u2", status: "Validée" }, { id: "c", userId: "u3", status: "Validée" },
    { id: "d", userId: "u4", status: "Validée" }, { id: "e", userId: "u4", status: "Validée" }, { id: "x", userId: "u2", status: "En attente" },
  ];
  // u2 et u5 : 2 500 vues chacun ; u5, inscrit plus tôt, passe devant. u3 est suspendu ; u4 n'a pas de vue cette semaine.
  const all = [...clips, { id: "f", userId: "u5", status: "Validée" }, { id: "g", userId: "u6", status: "Refusée" }];
  const g2 = new Map([...gains, ["f", 2500], ["x", 99999], ["g", 50000]]);
  const users = [{ id: "u1", createdAt: 5 * day, status: "Actif" }, { id: "u2", createdAt: 3 * day, status: "Actif" }, { id: "u3", createdAt: 1 * day, status: "Suspendu" },
    { id: "u4", createdAt: 2 * day, status: "Actif" }, { id: "u5", createdAt: 1 * day, status: "Actif" }, { id: "u6", createdAt: 1 * day, status: "Actif" }];
  const prizes = [10000, 7000, 0, 4000, 3000, 2500, 2000, 1500, 1000, 1000];
  assert.deepEqual(weeklyRanking(all, g2, users, prizes), [
    { rank: 1, userId: "u1", views: 4500, prize: 10000 }, { rank: 2, userId: "u5", views: 2500, prize: 7000 }, { rank: 3, userId: "u2", views: 2500, prize: 0 },
  ]);
  // Au-delà du 10e : classé, sans prime.
  const many = Array.from({ length: 12 }, (_, i) => ({ id: `k${i}`, userId: `m${i}`, status: "Validée" }));
  const ranked = weeklyRanking(many, new Map(many.map((c, i) => [c.id, 1000 - i])), many.map((c, i) => ({ id: c.userId, createdAt: i, status: "Actif" })), prizes);
  assert.deepEqual([ranked.length, ranked[9].prize, ranked[10].prize, ranked[11].rank], [12, 1000, 0, 12]);
});

test("textes du classement : libellé de la prime, notification, journal", () => {
  assert.deepEqual([rankText(1), rankText(2), rankText(10)], ["1er", "2e", "10e"]);
  assert.equal(prizeLabel("2026-W43", 1), "Prime classement · semaine 43 (1er)");
  assert.equal(prizeNotice("2026-W43", 3, 5000), "Vous êtes 3e du classement de la semaine 43 : +5 000 DA");
  assert.equal(prizeNotice("2026-W09", 1, 12345678), "Vous êtes 1er du classement de la semaine 9 : +12 345 678 DA");
  assert.equal(weekClosedText("2026-W43", 0, 0), "Classement de la semaine 43 clôturé : aucune prime versée.");
  assert.equal(weekClosedText("2026-W43", 1, 10000), "Classement de la semaine 43 clôturé : 1 prime versée (10 000 DA).");
  assert.equal(weekClosedText("2026-W43", 10, 37000), "Classement de la semaine 43 clôturé : 10 primes versées (37 000 DA).");
});

test("parrainage : codes, parrain accepté, décision de la prime et textes", () => {
  assert.equal(referralCode([0, 1, 2, 3, 31, 32, 255, 100]), "ABCD9A9E");
  assert.match(referralCode(Array.from({ length: 8 }, (_, i) => i * 37)), /^[A-HJ-NP-Z2-9]{8}$/);
  assert.deepEqual(["  yacine26 ", "1A2B3C4D", "abc", "x".repeat(17), "YAC-INE", 42, null].map(normalizeReferralCode), ["YACINE26", "1A2B3C4D", null, null, null, null, null]);
  assert.equal(referralFirstName("  Nour El Houda Saidi "), "Nour");
  const yacine = { id: "y", role: "clipper", status: "Actif" };
  assert.equal(acceptedReferrer(yacine, { id: "n", role: "clipper" }), yacine);
  assert.equal(acceptedReferrer(yacine, { id: "n", role: "agence" }), null);
  assert.equal(acceptedReferrer(yacine, { id: "y", role: "clipper" }), null);
  assert.equal(acceptedReferrer({ ...yacine, status: "Suspendu" }, { id: "n", role: "clipper" }), null);
  assert.equal(acceptedReferrer({ ...yacine, role: "agence" }, { id: "n", role: "clipper" }), null);
  assert.equal(acceptedReferrer(null, { id: "n", role: "clipper" }), null);
  assert.equal(payoutKey(" 0021234567 Clé-89 "), payoutKey("0021234567clé89"));
  assert.equal(referralDecision({ status: "Actif", payoutAccount: "0021234567 clé 89" }, { payoutAccount: "00799999001234567890" }), "pay");
  assert.equal(referralDecision({ status: "Actif", payoutAccount: "0021234567 clé 89" }, { payoutAccount: "0021234567 CLÉ 89" }), "same-account");
  assert.equal(referralDecision({ status: "Suspendu", payoutAccount: null }, { payoutAccount: "1" }), "suspended");
  // Comptes vides : jamais « le même compte ».
  assert.equal(referralDecision({ status: "Actif", payoutAccount: null }, { payoutAccount: "" }), "pay");
  assert.equal(referralLabel("Karim Belkacem"), "Parrainage · premier retrait de Karim Belkacem");
  assert.equal(referralNotice("Karim Belkacem", 1000), "Karim Belkacem a fait son premier retrait : +1 000 DA de parrainage");
  assert.equal(referralRefusedText("Yacine Benali", "Lina Mansouri", "suspended"), "Prime de parrainage non versée : Yacine Benali, parrain de Lina Mansouri, est suspendu.");
});
