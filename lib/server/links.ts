// Liens des notifications : la route de l'app (/espace) qui mène à l'élément concerné, « #/<espace>/<page>/<id> ».
// Partagé par les services, la version autonome (web/offline/) et les données d'exemple : mêmes liens partout.
import type { PublicationStatus, Role } from "./db/schema";

export const link = {
  /** Nouvelle campagne pour les clippers : ouvre sa fiche (page Découvrir). */
  clipperCampaign: (campaignId: string) => `#/clipper/decouvrir/${campaignId}`,
  /** Campagne de l'agence (vérification, statut, budget consommé) : ouvre ses détails. */
  agencyCampaign: (campaignId: string) => `#/agence/campagnes/${campaignId}`,
  /** Budget rendu à l'agence : la ligne de la campagne dans Budget. */
  agencyBudget: (id: string) => `#/agence/budget/${id}`,
  /** Paiement en ligne d'une recharge en mode simulé : la page de paiement simulée de l'app (« Payer » ou « Annuler »). */
  agencyPayment: (transactionId: string) => `#/agence/paiement/${transactionId}`,
  /** Campagne soumise, modifiée ou relancée par une agence : sa fiche d'examen dans l'administration. */
  adminCampaign: (campaignId: string) => `#/admin/campagnes/${campaignId}`,
  /** Clip à examiner : sa fiche dans la modération. */
  adminClip: (publicationId: string) => `#/admin/moderation/${publicationId}`,
  /** Recours d'un clipper sur un clip refusé : sa fiche dans la modération (onglet Recours). */
  adminAppeal: (appealId: string) => `#/admin/moderation/${appealId}`,
  /** Profil d'un utilisateur dans l'administration (demande de badge de vérification). */
  adminUser: (userId: string) => `#/admin/utilisateur/${userId}`,
  /** Profil de l'agence (badge de vérification accordé, refusé ou retiré). */
  agencyProfile: () => "#/agence/profil",
  /** Clip validé ou refusé. */
  clip: (publicationId: string) => `#/clipper/publications/${publicationId}`,
  /** Gain, retrait : l'opération dans le portefeuille du clipper. */
  clipperTx: (transactionId: string) => `#/clipper/portefeuille/${transactionId}`,
  /** Retrait ou recharge à traiter. */
  adminPayment: (transactionId: string) => `#/admin/retraits/${transactionId}`,
  /** Retrait (clipper) ou recharge (agence) traité par l'équipe. */
  userTx: (type: string, transactionId: string) => (type === "recharge" ? link.agencyBudget(transactionId) : link.clipperTx(transactionId)),
  /** Conversation du clipper sur une campagne (Messages) : identifiée par la campagne seule. */
  clipperThread: (campaignId: string) => `#/clipper/messages/${campaignId}`,
  /** Conversation avec un clipper sur une campagne de l'agence : « <campagne>~<clipper> » (threadKey, rules.ts). */
  agencyThread: (campaignId: string, clipperId: string) => `#/agence/messages/${campaignId}~${clipperId}`,
  /** Conversation avec un clipper sur une campagne de ClipBoost, à laquelle l'équipe répond. */
  adminThread: (campaignId: string, clipperId: string) => `#/admin/messages/${campaignId}~${clipperId}`,
  /** Accueil de l'espace (compte réactivé ou suspendu). */
  home: (role: Role) => ({ admin: "#/admin/apercu", agence: "#/agence/apercu", clipper: "#/clipper/accueil" })[role],
};

/** Ce que l'utilisateur voit déjà (stateFor), du plus récent au plus ancien. */
export type LinkContext = {
  campaigns: { id: string; title: string }[];
  publications: { id: string; title: string; status: PublicationStatus }[];
  transactions: { id: string; ref: string; type: string; publicationId: string | null }[];
};

/**
 * Lien d'une notification enregistrée avant l'ajout des liens (colonne vide, ancienne copie hors ligne) :
 * déduit de son texte (mêmes phrases que les services) et des données visibles par son destinataire.
 * L'élément est retrouvé par son titre ou sa référence ; sinon la page concernée ; null si le texte est inconnu.
 */
export function inferLink(role: Role, text: string, ctx: LinkContext): string | null {
  const campaign = (title: string) => ctx.campaigns.find((c) => c.title === title);
  const pub = (title: string, status?: PublicationStatus) => ctx.publications.find((p) => p.title === title && (!status || p.status === status));
  let m: RegExpMatchArray | null;
  if (/^Votre compte a été (réactivé|suspendu)\.$/.test(text)) return link.home(role);
  if (role === "clipper") {
    if ((m = text.match(/^Nouvelle campagne : (.+) \([^()]+ DA \/1K\)\.$/))) { const c = campaign(m[1]); return c ? link.clipperCampaign(c.id) : "#/clipper/decouvrir"; }
    if ((m = text.match(/^\+.+ pour « (.+) »\. Retirable/))) {
      const p = pub(m[1]), t = p && ctx.transactions.find((x) => x.type === "gain" && x.publicationId === p.id);
      return t ? link.clipperTx(t.id) : "#/clipper/portefeuille";
    }
    if ((m = text.match(/^Clip « (.+) » refusé : /))) { const p = pub(m[1], "Refusée") ?? pub(m[1]); return p ? link.clip(p.id) : "#/clipper/publications"; }
    if ((m = text.match(/^Votre clip « (.+) » a été validé\.$/))) { const p = pub(m[1], "Validée") ?? pub(m[1]); return p ? link.clip(p.id) : "#/clipper/publications"; }
    if (text.startsWith("Votre retrait ")) return "#/clipper/portefeuille";
  } else if (role === "agence") {
    if ((m = text.match(/ non consommés sur « (.+) » ont été rendus/))) { const c = campaign(m[1]); return c ? link.agencyBudget(c.id) : "#/agence/budget"; }
    if ((m = text.match(/^(?:Votre campagne|Le budget de) « (.+) » /))) { const c = campaign(m[1]); return c ? link.agencyCampaign(c.id) : "#/agence/campagnes"; }
    if (text.startsWith("Votre recharge ")) return "#/agence/budget";
    if (/vérifi/.test(text) && /(agence|badge)/i.test(text)) return link.agencyProfile();
  } else if (role === "admin") {
    if ((m = text.match(/ a (?:soumis|modifié|modifié et relancé) la campagne « (.+) »\.$/))) { const c = campaign(m[1]); return c ? link.adminCampaign(c.id) : "#/admin/campagnes"; }
    if (/ a annulé la campagne « .+ » avant sa vérification\.$/.test(text)) return "#/admin/campagnes";
    if (/ demande le badge de vérification\.$/.test(text)) return "#/admin/utilisateurs";
    if ((m = text.match(/ annonce une recharge de .+\(réf\. ([^)]+)\)\.$/))) { const t = ctx.transactions.find((x) => x.ref === m![1]); return t ? link.adminPayment(t.id) : "#/admin/retraits"; }
    if (/ demande un retrait de /.test(text)) return "#/admin/retraits";
  }
  return null;
}
