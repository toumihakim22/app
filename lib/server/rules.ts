// Règles métier pures (sans base de données), partagées par l'API et les tests.

export type PayoutCampaign = { rate: number; minPayout: number; maxPayout: number };

/** Gain brut d'un clip : tarif pour 1 000 vues, sans seuil ni plafond. */
export const rawEarnings = (views: number, rate: number) => Math.floor((views * rate) / 1000);

/** Un clip sous le seuil minimum n'est ni examiné ni payé. */
export const belowMin = (views: number, c: PayoutCampaign) => rawEarnings(views, c.rate) < c.minPayout;

/** Gain d'un clip validé : zéro sous le seuil, et jamais plus que le plafond. */
export function payoutFor(views: number, c: PayoutCampaign): number {
  if (belowMin(views, c)) return 0;
  return Math.min(rawEarnings(views, c.rate), c.maxPayout);
}

/** Vues nécessaires pour atteindre un montant donné. */
export const viewsFor = (amount: number, rate: number) => Math.ceil((amount * 1000) / rate);

/** Montant à prélever sur le crédit de l'agence : budget + commission ClipBoost. */
export const fundingCost = (budget: number, commissionRate: number) => budget + Math.round((budget * commissionRate) / 100);

/** Frais d'un retrait instantané. */
export function instantFee(amount: number, feePercent: number, minFee: number) {
  return Math.max(minFee, Math.round((amount * feePercent) / 100));
}

/**
 * Montant supplémentaire à créditer quand les vues d'un clip validé évoluent :
 * on paie la différence avec ce qui a déjà été versé, sans dépasser le budget restant.
 */
export function payoutDelta(views: number, c: PayoutCampaign & { budget: number; spent: number }, alreadyPaid: number) {
  const due = payoutFor(views, c) - alreadyPaid;
  if (due <= 0) return 0;
  return Math.max(0, Math.min(due, c.budget - c.spent));
}

export function validateCampaignNumbers(n: { rate: number; budget: number; minPayout: number; maxPayout: number }, minBudget: number): string | null {
  if (n.budget < minBudget) return `Le budget minimum est de ${minBudget} DA`;
  if (n.maxPayout <= n.minPayout) return "Le plafond doit être supérieur au seuil minimum";
  if (n.maxPayout > n.budget) return "Le plafond par clip ne peut pas dépasser le budget";
  return null;
}

/**
 * Motif saisi par l'équipe (refus d'une campagne, d'un badge), cité en fin de notification
 * avec un seul point final : « … a été refusée : motif. », même si le motif se termine déjà par un point.
 */
export const sentence = (text: string) => (/[.!?…]$/.test(text) ? text : `${text}.`);
