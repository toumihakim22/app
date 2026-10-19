import assert from "node:assert/strict";
import { test } from "node:test";
import { belowMin, bioHasCode, fundingCost, handleInUrl, instantFee, normalizeHandle, payoutDelta, payoutFor, sentence, socialCode, socialLinkError, validateCampaignNumbers, viewsFor } from "../lib/server/rules";

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
