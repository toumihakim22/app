// Langue de l'interface : français (langue source), anglais ou arabe (lecture de droite à gauche).
// t("Texte français") renvoie sa traduction dans la langue choisie (I18N.en, I18N.ar), sinon le texte tel quel.
// Paramètres : t("Bonjour {name}", { name: esc(u.name) }) ; les valeurs sont insérées telles quelles (HTML déjà échappé).
// Dictionnaires : web/src/i18n/<langue>/<zone>.js, chacun ajoute ses entrées avec Object.assign(I18N.en, { … }).
// Une entrée peut aussi être un pluriel { one, two, few, many, other } (règles CLDR, voir tPlural).
// Les valeurs envoyées au serveur (statuts, catégories, moyens de paiement…) restent en français : on ne traduit que l'affichage.

const LOCALES = {
  fr: { label: "Français", short: "FR", dir: "ltr", intl: "fr-FR" },
  en: { label: "English", short: "EN", dir: "ltr", intl: "en-GB" },
  ar: { label: "العربية", short: "ع", dir: "rtl", intl: "ar-DZ" },
};
const I18N = { en: {}, ar: {} };
// Textes du serveur avec paramètres (erreurs, notifications, journal d'activité) : [motif, traduction avec $1, $2…].
const I18N_RX = { en: [], ar: [] };
const LANG_KEY = "clipboost-lang";
let LANG = (() => { try { const l = localStorage.getItem(LANG_KEY); return LOCALES[l] ? l : "fr"; } catch (e) { return "fr"; } })();

function t(s, params) {
  let out = s;
  if (LANG !== "fr") {
    const entry = I18N[LANG][s];
    if (typeof entry === "string") out = entry;
    else if (entry && typeof entry === "object") out = entry.other || s;
  }
  return params ? String(out).replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m)) : out;
}

// Forme plurielle d'un mot selon n : en français « 0 ou 1 → singulier » ; en anglais et en arabe, Intl.PluralRules.
// L'entrée de traduction est cherchée sous la forme plurielle française (many), puis singulière (one).
function tPlural(n, one, many) {
  const a = Math.abs(n);
  if (LANG === "fr") return a <= 1 ? one : many;
  const dict = I18N[LANG], entry = dict[many] !== undefined ? dict[many] : dict[one];
  let cat = "other";
  try { cat = new Intl.PluralRules(LOCALES[LANG].intl).select(a); } catch (e) { cat = a === 1 ? "one" : "other"; }
  if (entry && typeof entry === "object") return entry[cat] || entry.other || many;
  return t(cat === "one" ? one : many);
}

// Texte venu du serveur : traduction exacte, sinon premier motif qui correspond, sinon le texte d'origine.
function tServer(s) {
  if (LANG === "fr" || !s) return s;
  const exact = I18N[LANG][s];
  if (typeof exact === "string") return exact;
  for (const [rx, out] of I18N_RX[LANG]) {
    const m = String(s).match(rx);
    if (m) return out.replace(/\$(\d)/g, (_, i) => (m[+i] !== undefined ? tServer(m[+i]) : ""));
  }
  return s;
}

const isRtl = () => LOCALES[LANG].dir === "rtl";

function applyLangAttrs() {
  const d = document.documentElement;
  d.lang = LANG;
  d.dir = LOCALES[LANG].dir;
}

// Changement de langue : mémorisé dans le navigateur et sur le compte (si connecté), puis la page est réaffichée.
function setLang(l, { remember = true } = {}) {
  if (!LOCALES[l]) return;
  const changed = l !== LANG;
  LANG = l;
  if (remember) { try { localStorage.setItem(LANG_KEY, l); } catch (e) {} }
  applyLangAttrs();
  if (!changed) return;
  if (remember && state.session) api("PATCH", "/api/me", { locale: l }).catch(() => {});
  render();
}

// Après la connexion : la langue enregistrée sur le compte s'applique si ce navigateur n'a pas fait de choix.
function adoptAccountLang(locale) {
  let local = null;
  try { local = localStorage.getItem(LANG_KEY); } catch (e) {}
  if (!local && LOCALES[locale] && locale !== LANG) { LANG = locale; applyLangAttrs(); }
}

// Boutons de langue [data-lang-set="fr|en|ar"] (menu du compte, Paramètres, écrans de connexion).
document.addEventListener("click", (e) => {
  const b = e.target && e.target.closest ? e.target.closest("[data-lang-set]") : null;
  if (!b) return;
  e.preventDefault();
  setLang(b.dataset.langSet);
});

applyLangAttrs();
