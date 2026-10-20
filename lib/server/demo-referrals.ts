// Données d'exemple uniquement : parrainage de démonstration, partagé par scripts/seed.mts et la version autonome
// (web/offline/seed.ts). Yacine parraine Amira (son premier retrait attend l'équipe : le valider verse la prime), Lina
// (inscrite, sans retrait) et Karim (premier retrait déjà versé : prime de parrainage déjà payée à Yacine).

/** Code de parrainage de Yacine (lien de démonstration « /espace?ref=YACINE26#/inscription »). */
export const DEMO_REFERRAL_CODE = "YACINE26";
/** Filleuls de Yacine (emails des comptes d'exemple). */
export const DEMO_REFEREES = ["amira@clipboost.dz", "lina@clipboost.dz", "karim@clipboost.dz"];
/** Premier retrait de Karim : demandé puis versé (jours avant le lancement), vers son compte BaridiMob. */
export const DEMO_REFEREE_PAYOUT = { email: "karim@clipboost.dz", amount: 3000, requestedDaysAgo: 2.4, paidDaysAgo: 2, method: "BaridiMob", account: "00799999007654321098" };
