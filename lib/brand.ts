// Nom de la plateforme, lu par tout le site : accueil, application /espace, serveur, PDF, emails et version autonome.
// Pour renommer la plateforme, modifiez seulement brand.json (à la racine du projet) :
//   - name : le nom affiché partout (« ClipBoost ») ;
//   - slug : la version en minuscules sans espace, utilisée dans les noms de fichiers exportés (« clipboost-transactions-….csv »).
// L'application /espace (web/src, JavaScript du navigateur) le reçoit de web/build.mjs dans la constante BRAND,
// et ses textes l'écrivent « {brand} » (remplacé par t() et tServer(), voir web/src/i18n.js).
//
// Restent volontairement à part (à traiter lors du vrai changement de nom, car les changer a des effets) :
//   - les adresses email des comptes (@clipboost.dz) et le mot de passe d'exemple Clipboost2026 ;
//   - les noms techniques : cookie de session cb_session, clés du navigateur (clipboost-theme, clipboost-lang…),
//     verrous de la base (clipboost-documents…), window.__CLIPBOOST_OFFLINE__ : les changer déconnecterait les
//     utilisateurs ou effacerait leurs préférences ;
//   - le texte des leçons de départ de l'Académie (lib/server/academy-lessons.ts) : la migration 0011 l'a déjà
//     écrit dans la base, l'équipe le modifie depuis l'espace Admin ;
//   - les commentaires et la documentation (README, docs/).
import brand from "../brand.json";

export const BRAND_NAME: string = brand.name;
export const BRAND_SLUG: string = brand.slug;
