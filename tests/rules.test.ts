import assert from "node:assert/strict";
import { test } from "node:test";
import { belowMin, fundingCost, instantFee, payoutDelta, payoutFor, sentence, validateCampaignNumbers, viewsFor } from "../lib/server/rules";

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
