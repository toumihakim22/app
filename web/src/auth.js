// Inscription par email (avec code de vérification envoyé par le serveur) ou avec Google, Apple, Discord ; connexion et
// mot de passe oublié. Rendu : docs/design-system.md §6.5. Les helpers propres à ce fichier sont préfixés « auth… ».

// ---------- Retour d'une connexion Google, Apple ou Discord (serveur) ----------
// En cas d'échec, le serveur renvoie vers /espace?oauth_error=<code>#/connexion (lib/server/oauth.ts). Le code est lu
// une seule fois, au chargement, puis retiré de l'adresse (un rechargement ne réaffiche pas le message) ; le message
// s'affiche sur la page de connexion (state.auth.oauthError, posé par resetAuth au démarrage). Le fournisseur choisi
// est noté dans sessionStorage juste avant le départ (authStartOAuth) : le message « email non vérifié » peut le nommer.
const AUTH_OAUTH_KEY = "clipboost-oauth";
let authOAuthPending = (() => {
  let provider = "";
  try { provider = sessionStorage.getItem(AUTH_OAUTH_KEY) || ""; sessionStorage.removeItem(AUTH_OAUTH_KEY); } catch (e) {}
  try {
    const q = new URLSearchParams(location.search);
    if (!q.has("oauth_error")) return null;
    const code = q.get("oauth_error") || "";
    q.delete("oauth_error");
    const rest = q.toString();
    try { history.replaceState(history.state, "", `${location.pathname}${rest ? `?${rest}` : ""}${location.hash}`); } catch (e) {}
    return { code, provider };
  } catch (e) {
    return null;
  }
})();

// ---------- Lien de parrainage (/espace?ref=<code>#/inscription) ----------
// Le code est lu une fois au chargement, retiré de l'adresse et gardé 30 jours dans ce navigateur (localStorage) : il
// accompagne l'inscription d'un clipper, par email comme avec Google, Apple ou Discord. L'écran d'inscription affiche
// « Invité par {prénom} » si le code est valable (GET /api/referral/<code>) ; un code inconnu est oublié sans message
// (l'inscription reste possible). Le code est oublié dès qu'un compte est ouvert (authForgetReferral, appelé par refresh).
const AUTH_REF_KEY = "clipboost-ref";
const AUTH_REF_DAYS = 30;
// Même règle que normalizeReferralCode (lib/server/rules.ts) : 4 à 16 lettres ou chiffres, en majuscules.
const authRefCode = (v) => { const c = String(v || "").trim().toUpperCase(); return /^[A-Z0-9]{4,16}$/.test(c) ? c : ""; };
(() => {
  try {
    const q = new URLSearchParams(location.search);
    if (!q.has("ref")) return;
    const code = authRefCode(q.get("ref"));
    q.delete("ref");
    const rest = q.toString();
    try { history.replaceState(history.state, "", `${location.pathname}${rest ? `?${rest}` : ""}${location.hash}`); } catch (e) {}
    if (code) localStorage.setItem(AUTH_REF_KEY, JSON.stringify({ code, at: Date.now() }));
  } catch (e) {}
})();
// Code gardé (moins de 30 jours), sinon "".
function authStoredReferral() {
  try {
    const v = JSON.parse(localStorage.getItem(AUTH_REF_KEY) || "null");
    if (v && authRefCode(v.code) && Date.now() - Number(v.at) < AUTH_REF_DAYS * 86_400_000) return authRefCode(v.code);
  } catch (e) {}
  return "";
}
function authForgetReferral() {
  try { localStorage.removeItem(AUTH_REF_KEY); } catch (e) {}
  authReferral = { code: "", firstName: "", status: "none" };
}
// Parrain du code gardé : status « idle » (à vérifier), « loading », « ok » (firstName connu), « none » (aucun code ou code inconnu).
let authReferral = { code: "", firstName: "", status: "idle" };
function authReferralInfo() {
  const code = authStoredReferral();
  if (!code) return { code: "", firstName: "", status: "none" };
  if (authReferral.code !== code) authReferral = { code, firstName: "", status: "idle" };
  if (authReferral.status === "idle") {
    authReferral.status = "loading";
    const asked = authReferral;
    api("GET", `/api/referral/${encodeURIComponent(code)}`)
      .then((r) => { if (authReferral === asked) { asked.firstName = String(r.firstName || ""); asked.status = asked.firstName ? "ok" : "none"; } })
      .catch((e) => {
        if (authReferral !== asked) return;
        // Code inconnu : oublié. Autre erreur (réseau) : le code reste envoyé avec l'inscription, sans « Invité par ».
        asked.status = "none";
        if (e.status === 404) { try { localStorage.removeItem(AUTH_REF_KEY); } catch (x) {} }
      })
      .finally(() => { if (authReferral === asked && state.route.view === "inscription") render(); });
  }
  return authReferral;
}
// Code envoyé avec l'inscription d'un clipper (le serveur le vérifie de nouveau et l'ignore s'il n'est pas valable).
const authSignupRef = (role) => (role === "clipper" ? authStoredReferral() || undefined : undefined);
// Bandeau « Invité par … » de l'écran d'inscription (clipper seulement).
function authReferralNote(role) {
  const r = authReferralInfo();
  if (role !== "clipper" || r.status !== "ok") return "";
  return `<div class="${TILE} flex items-center gap-3" role="status">
      <span class="grid size-9 shrink-0 place-items-center rounded-tile bg-brand-soft text-brand-fg" aria-hidden="true">${icon("gift", "size-[18px]")}</span>
      <div class="min-w-0"><p class="text-sm font-semibold text-fg">${t("Invité par {name}", { name: `<span dir="auto">${esc(r.firstName)}</span>` })}</p>
        <p class="mt-0.5 text-xs text-fg-muted">${t("Créez votre compte Clipper\u00a0: {name} recevra une prime à votre premier retrait.", { name: `<span dir="auto">${esc(r.firstName)}</span>` })}</p></div>
    </div>`;
}

// Messages des codes d'erreur du serveur (OAuthErrorCode), traduits à l'affichage. « email » nomme le fournisseur (authOAuthMessage).
const AUTH_OAUTH_ERRORS = {
  denied: "Connexion annulée.",
  state: "La connexion a expiré, réessayez.",
  no_account: "Aucun compte ClipBoost n'est associé à ce compte. Inscrivez-vous d'abord.",
  admin: "Les comptes administrateurs se connectent avec leur mot de passe.",
  suspended: "Ce compte est suspendu.",
  signups_closed: "Les inscriptions sont fermées pour le moment.",
  config: "Ce mode de connexion n'est pas disponible.",
  maintenance: "ClipBoost est en maintenance, réessayez plus tard.",
};
function authOAuthMessage({ code, provider }) {
  if (code === "email") {
    const p = AUTH_PROVIDERS[provider];
    return p ? t("Votre compte {provider} n'a pas d'adresse email vérifiée.", { provider: p.name }) : t("Votre compte n'a pas d'adresse email vérifiée.");
  }
  return Object.prototype.hasOwnProperty.call(AUTH_OAUTH_ERRORS, code) ? t(AUTH_OAUTH_ERRORS[code]) : t("La connexion a échoué, réessayez.");
}
// Alerte en tête de la page de connexion. « Connexion annulée » est une information (choix de la personne) ;
// « aucun compte » propose de créer un compte.
function authOAuthAlert(err) {
  if (!err) return "";
  const msg = esc(authOAuthMessage(err));
  if (err.code === "denied") return alertBox("info", msg);
  return alertBox("danger", err.code === "no_account" ? `${msg} <a href="#/inscription" class="${btn("link")}">${t("Créer un compte")}</a>` : msg);
}

// ---------- Google, Apple, Discord : marques et boutons « Continuer avec … » ----------
// Marques officielles en SVG ; celle d'Apple prend la couleur du texte (noire en clair, blanche en sombre). Les
// boutons ne sont proposés que pour les fournisseurs configurés sur le serveur (db.oauth ; les trois, simulés, dans la
// version autonome), toujours dans cet ordre.
const AUTH_PROVIDERS = {
  google: {
    name: "Google",
    mark: (cls) => `<svg viewBox="0 0 48 48" class="${cls}" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`,
  },
  apple: {
    name: "Apple",
    mark: (cls) => `<svg viewBox="0 0 24 24" class="${cls}" fill="currentColor" aria-hidden="true"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>`,
  },
  discord: {
    name: "Discord",
    mark: (cls) => `<svg viewBox="0 0 24 24" class="${cls}" aria-hidden="true"><path fill="#5865F2" d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>`,
  },
};
const authProviders = () => Object.keys(AUTH_PROVIDERS).filter((p) => (db.oauth || []).includes(p));
// Bouton en attente pendant le départ vers le fournisseur.
const AUTH_SPINNER = `<svg viewBox="0 0 24 24" class="shrink-0 animate-spin" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.25" stroke-width="2.5"/><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`;

// Bloc au-dessus du formulaire email (connexion et inscription) : un bouton par fournisseur, puis le séparateur « ou ».
// À l'inscription, le rôle est celui de la carte choisie au-dessus (Clipper ou Agence) ; continuer vaut acceptation des
// conditions, comme la case du formulaire email.
function authOAuthBlock(mode) {
  const list = authProviders();
  if (!list.length) return "";
  const signup = mode === "signup";
  return `<div class="grid gap-3">
      <div class="grid gap-3" role="group" aria-label="${esc(signup ? t("S'inscrire avec un compte existant") : t("Se connecter avec un compte existant"))}">${list.map((p) =>
        `<button type="button" data-action="auth-oauth" data-value="${p}"${window.__CLIPBOOST_OFFLINE__ ? ' aria-haspopup="dialog"' : ""} class="${btn("secondary", "lg", "w-full aria-busy:pointer-events-none")}">${AUTH_PROVIDERS[p].mark("shrink-0")}<span>${t("Continuer avec {provider}", { provider: AUTH_PROVIDERS[p].name })}</span></button>`).join("")}</div>
      ${signup ? `<p class="text-center text-xs leading-5 text-fg-subtle">${t("En continuant, vous acceptez les {terms} et la {privacy} de ClipBoost.", authLegalLinks())}</p>` : ""}
    </div>
    <div class="flex items-center gap-3 text-small text-fg-subtle"><span class="h-px flex-1 bg-line" aria-hidden="true"></span>${t("ou")}<span class="h-px flex-1 bg-line" aria-hidden="true"></span></div>`;
}

// Liens « conditions d'utilisation » et « politique de confidentialité » (pages du site public, en français), insérés
// dans les phrases d'acceptation de l'inscription.
const authLegalLinks = () => ({
  terms: `<a href="/#conditions" target="_blank" rel="noopener" class="${btn("link")}">${t("conditions d'utilisation")}</a>`,
  privacy: `<a href="/#confidentialite" target="_blank" rel="noopener" class="${btn("link")}">${t("politique de confidentialité")}</a>`,
});

// Clic sur « Continuer avec … ». En ligne : départ vers le serveur (/api/auth/oauth/<fournisseur>), qui renvoie vers la
// page de consentement du fournisseur ; le bouton passe en attente jusqu'au départ. Version autonome : fenêtre de
// connexion simulée (authModal), aucune donnée ne quitte le navigateur.
function authStartOAuth(provider, el) {
  const P = AUTH_PROVIDERS[provider];
  if (!P || !authProviders().includes(provider) || authLeaving) return;
  if (el && (el.getAttribute("aria-disabled") === "true" || el.getAttribute("aria-busy") === "true")) return;
  const mode = state.route.view === "inscription" ? "signup" : "login", role = state.auth.form.role === "agence" ? "agence" : "clipper";
  state.auth.oauthError = null;
  if (window.__CLIPBOOST_OFFLINE__) {
    state.modal = { type: "auth-oauth", id: `${provider}:${mode}`, provider, mode, role, identity: authDemoIdentity(provider, mode, role), error: "", errors: {} };
    return render();
  }
  try { sessionStorage.setItem(AUTH_OAUTH_KEY, provider); } catch (e) {}
  authLeaving = true;
  root.querySelectorAll('[data-action="auth-oauth"]').forEach((b) => { if (b !== el) b.setAttribute("aria-disabled", "true"); });
  if (el) { el.setAttribute("aria-busy", "true"); el.innerHTML = `${AUTH_SPINNER}<span>${t("Redirection vers {provider}…", { provider: P.name })}</span>`; }
  // Inscription d'un clipper par un lien de parrainage : le code part avec le parcours (cookie du serveur).
  const ref = mode === "signup" ? authSignupRef(role) : undefined;
  const q = new URLSearchParams(mode === "signup" ? { mode, role, ...(ref ? { ref } : {}) } : { mode });
  location.href = `/api/auth/oauth/${provider}?${q}`;
}
// Départ vers le fournisseur en cours (un double clic ne relance pas la redirection).
let authLeaving = false;
// Retour arrière depuis la page du fournisseur (page restaurée par le cache du navigateur) : boutons de nouveau actifs.
window.addEventListener("pageshow", (e) => {
  if (!e.persisted) return;
  authLeaving = false;
  if (state.route.area === "auth") render();
});

// Actions propres aux écrans de connexion (appelé par main.js quand la coquille ne connaît pas l'action).
function handleAuthAction(action, el) {
  if (action === "auth-oauth") authStartOAuth(el.dataset.value, el);
}

// ---------- Version autonome : connexion Google, Apple ou Discord simulée ----------
// Identité proposée : à la connexion, l'adresse déjà tapée (sinon le clipper d'exemple, pour que la démonstration
// aboutisse) ; à l'inscription, le nom et l'adresse déjà tapés, sinon une identité plausible pour le rôle choisi.
function authDemoIdentity(provider, mode, role) {
  const form = [...root.querySelectorAll(`form[data-form="${mode === "signup" ? "signup" : "login"}"]`)].find((f) => !f.closest('[aria-modal="true"]'));
  const typed = form ? Object.fromEntries(new FormData(form)) : {};
  const email = String(typed.email || "").trim().toLowerCase(), validEmail = isEmail(email);
  if (mode === "login") {
    if (!validEmail) return { name: "Yacine Benali", email: "yacine@clipboost.dz" };
    const known = AUTH_DEMO.find((d) => d.email === email);
    return { name: known ? known.name : authNameFromEmail(email), email };
  }
  const name = role === "agence" ? String(typed.agency || "").trim() : `${String(typed.first || "").trim()} ${String(typed.last || "").trim()}`.trim();
  const demo = role === "agence"
    ? { name: "Studio Casbah", email: "contact@studiocasbah.dz" }
    : { name: "Amine Bensalem", email: `amine.bensalem@${provider === "apple" ? "icloud.com" : "gmail.com"}` };
  return { name: name || demo.name, email: validEmail ? email : demo.email };
}
// « amine.bensalem@gmail.com » → « Amine Bensalem ».
const authNameFromEmail = (email) => email.split("@")[0].split(/[._+-]+/).filter(Boolean)
  .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") || email.split("@")[0];

// Deux flèches opposées entre la marque du fournisseur et celle de ClipBoost (échange de données).
const AUTH_EXCHANGE = `<svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8.5h15m-3.5-3.5L19 8.5 15.5 12M20 15.5H5m3.5 3.5L5 15.5 8.5 12"/></svg>`;

// Fenêtre « Continuer avec … » (state.modal = { type: "auth-oauth", provider, mode, role, identity, error, errors,
// errorValues }). identity : nom et adresse proposés (authDemoIdentity).
// Les champs suivent le brouillon de la modale (main.js) : une erreur ou un changement de langue ne perd pas la saisie.
function authModal() {
  const m = state.modal;
  if (!m || m.type !== "auth-oauth" || !AUTH_PROVIDERS[m.provider]) return "";
  const P = AUTH_PROVIDERS[m.provider], d = m.draft || {}, err = m.errors || {}, signup = m.mode === "signup", agency = m.role === "agence";
  const cur = (k) => String(d[k] !== undefined && d[k] !== null ? d[k] : m.identity[k]);
  // Erreur locale affichée tant que la valeur refusée n'a pas changé (un réaffichage après correction ne la remet pas).
  const bad = (k) => (err[k] && cur(k) === (m.errorValues || {})[k] ? err[k] : "");
  const inv = (k) => (bad(k) ? ' aria-invalid="true"' : "");
  const serverError = m.error
    ? alertBox("danger", `${esc(tServer(m.error))}${!signup && /Inscrivez-vous/.test(m.error) ? ` <a href="#/inscription" class="${btn("link")}">${t("Créer un compte")}</a>` : ""}`)
    : "";
  const roleNote = signup ? `<div class="${TILE} flex items-center gap-3">
      <span class="grid size-9 shrink-0 place-items-center rounded-tile bg-surface text-brand-fg" aria-hidden="true">${icon(agency ? "building" : "film", "size-[18px]")}</span>
      <p class="min-w-0 flex-1 text-small text-fg-muted">${t("Vous créez un compte {type}.", { type: `<span class="font-semibold text-fg">${agency ? t("Agence") : t("Clipper")}</span>` })}</p>
      <button type="button" data-action="close-modal" class="${btn("link", "", "text-small")}" aria-label="${esc(t("Changer de type de compte"))}">${t("Changer")}</button>
    </div>` : "";
  const nameHint = signup && agency ? t("Ce nom sera celui de votre agence\u00a0: vous pourrez le modifier dans votre profil.") : "";
  const emailHint = signup ? t("Si un compte ClipBoost utilise déjà cette adresse, vous y serez connecté.") : t("Un compte ClipBoost doit déjà utiliser cette adresse.");
  return modalShell({
    title: t("Continuer avec {provider}", { provider: P.name }),
    description: signup ? t("Inscription à ClipBoost") : t("Connexion à ClipBoost"),
    form: "auth-oauth",
    body: `<div class="grid gap-5">
      ${serverError}
      <div class="flex flex-col items-center text-center">
        <div class="flex items-center gap-3 text-fg-subtle" aria-hidden="true">
          <span class="grid size-12 place-items-center rounded-full border border-line bg-surface text-fg shadow-control">${P.mark("size-6")}</span>
          ${AUTH_EXCHANGE}
          <span class="grid size-12 place-items-center rounded-full bg-brand text-on-brand">${icon("play", "size-5 translate-x-px", true)}</span>
        </div>
        <p class="mt-3 text-sm text-fg-muted">${t("{provider} partagera votre nom et votre adresse email avec ClipBoost.", { provider: P.name })}</p>
      </div>
      ${alertBox("info", t("Simulation\u00a0: aucune donnée n'est envoyée à {provider}.", { provider: P.name }))}
      ${field(t("Nom"), `<input name="name" value="${esc(cur("name"))}" autocomplete="name" maxlength="80" class="${inputCls}"${inv("name")}/>`, nameHint, bad("name"))}
      ${field(t("Adresse email"), `<input name="email" type="email" value="${esc(cur("email"))}" autocomplete="email" dir="ltr" class="${inputCls}"${inv("email")}/>`, emailHint, bad("email"))}
      ${roleNote}
    </div>`,
    footer: `<button type="button" data-action="close-modal" class="${btn("ghost")}">${t("Annuler")}</button><button type="submit" class="${btn("primary")}">${t("Continuer")}</button>`,
  });
}

// Envoi de la fenêtre simulée : POST /api/auth/oauth/demo (mêmes règles que le serveur : compte relié, sinon même
// adresse, sinon création à l'inscription), puis l'espace du compte comme après une connexion par mot de passe.
let authBusy = false;
async function authOAuthDemo(data) {
  const m = state.modal;
  if (!m || m.type !== "auth-oauth" || authBusy) return;
  const name = String(data.name || "").trim(), email = String(data.email || "").trim().toLowerCase(), errors = {};
  if (!name) errors.name = t("Indiquez votre nom.");
  if (!isEmail(email)) errors.email = t("Adresse email invalide.");
  m.errors = errors; m.errorValues = { name: String(data.name || ""), email: String(data.email || "") }; m.error = "";
  if (Object.keys(errors).length) {
    render();
    const el = root.querySelector('[data-form="auth-oauth"] [aria-invalid="true"]');
    if (el) el.focus();
    return;
  }
  authBusy = true;
  const submit = root.querySelector('[data-form="auth-oauth"] button[type="submit"]');
  if (submit) submit.setAttribute("aria-disabled", "true");
  try {
    await api("POST", "/api/auth/oauth/demo", { provider: m.provider, name, email, role: m.role, mode: m.mode, ref: m.mode === "signup" ? authSignupRef(m.role) : undefined });
    state.modal = null;
    await enter();
  } catch (e) {
    if (state.modal === m) { m.error = e.message; render(); }
    else toast(tServer(e.message), "danger");
  } finally {
    authBusy = false;
  }
}

// ---------- Mise en page : panneau « night » (≥ lg) + colonne du formulaire ----------

// Garanties réelles, tirées des réglages publics (jamais de chiffres inventés sur l'écran du mot de passe).
function authGuarantees() {
  const s = db.settings;
  return [
    ["wallet", t("Retrait dès {amount} vers BaridiMob, CCP ou RIB", { amount: da(s.minWithdraw) })],
    ["shield", s.holdDays > 0 ? t("Gains libérés après {days} de contrôle", { days: plural(s.holdDays, "jour", "jours") }) : t("Gains disponibles dès la validation du clip")],
    ["check", t("Commission affichée, aucun frais caché")],
  ];
}

// En-tête de la colonne : logo (< lg ; le panneau de gauche le porte au-delà), retour au site (≥ sm ; sur mobile, le
// logo y mène), langue (FR / EN / ع) et thème. Tient sur une ligne dès 360 px ; repli sur deux lignes en dessous.
function authLayout(content) {
  authKeepForms();
  return `<div class="flex min-h-dvh flex-col bg-surface">${siteBanner()}
  <div class="grid flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
    <aside class="relative hidden overflow-hidden border-e border-night-line bg-night p-12 text-on-brand lg:sticky lg:top-0 lg:flex lg:max-h-dvh lg:flex-col">
      <div class="pointer-events-none absolute -start-24 -top-24 size-96 rounded-full bg-brand/30 blur-3xl" aria-hidden="true"></div>
      <div class="pointer-events-none absolute -bottom-32 -end-16 size-80 rounded-full bg-night-income/15 blur-3xl" aria-hidden="true"></div>
      <div class="relative flex flex-1 flex-col">
        <div>${logo({ tone: "text-on-brand" })}</div>
        <h2 class="mt-auto max-w-md text-h2 text-on-brand text-balance">${t("Vos clips méritent d'être payés.")}</h2>
        <p class="mt-4 max-w-md text-lg leading-8 text-on-brand/80">${t("Clippers et agences se retrouvent sur ClipBoost\u00a0: les uns monétisent leurs vidéos courtes, les autres lancent des campagnes qui touchent tout le public.")}</p>
        <ul class="mt-10 grid gap-4">${authGuarantees().map(([ic, text]) =>
          `<li class="flex items-center gap-3 text-sm text-on-brand/80"><span class="grid size-8 shrink-0 place-items-center rounded-full bg-on-brand/10 text-on-brand" aria-hidden="true">${icon(ic, "size-4")}</span>${text}</li>`).join("")}</ul>
        <div class="mt-10 opacity-90" aria-hidden="true">${cumulativeChart([0, 2, 1, 4, 3, 6, 5, 8, 9, 7, 11, 12], { h: "h-20", onNight: true, label: t("Illustration") })}</div>
        <p class="mt-10 flex items-center gap-2 text-xs text-on-brand/65">© 2026 ClipBoost · ${t("Fait en Algérie")} ${flagDz()}</p>
      </div>
    </aside>
    <div class="flex min-w-0 flex-col px-4 py-6 sm:px-10">
      <header class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <span class="lg:hidden">${logo({ size: "sm" })}</span>
        <div class="ms-auto flex items-center gap-1.5 sm:gap-2">
          <div class="hidden sm:block"><a href="/" class="${btn("ghost", "sm")}">${icon("arrowLeft", "size-4 rtl:-scale-x-100")}${t("Retour au site")}</a></div>
          ${langSwitch({ cls: "shrink-0" })}
          ${themeToggle()}
        </div>
      </header>
      <main id="main" class="mx-auto mt-6 w-full max-w-sm pb-10 sm:my-auto sm:py-10">${content}</main>
    </div>
  </div>${authModal()}</div>`;
}

// En-tête du formulaire : pastille facultative, h1, sous-titre.
const authHead = (title, text, badgeIcon = "") =>
  `${badgeIcon ? `<span class="mb-5 grid size-12 place-items-center rounded-full bg-brand-soft text-brand-fg" aria-hidden="true">${icon(badgeIcon, "size-[22px]")}</span>` : ""}
  <h1 class="text-title text-fg">${title}</h1>
  <p class="mt-2 text-sm text-fg-muted">${text}</p>`;

// Ligne d'aide ou d'erreur sous un champ (mêmes styles que field()).
const authHelp = (id, hint, error) => (error
  ? `<span id="${id}" class="flex items-center gap-1 text-xs font-medium text-danger-fg" role="alert">${icon("alert", "size-3.5 shrink-0")}${error}</span>`
  : hint ? `<span id="${id}" class="text-xs text-fg-subtle">${hint}</span>` : "");

// Champ mot de passe : libellé relié par for/id, pour que le bouton « Afficher » et la jauge restent hors du nom accessible.
function authPwdField({ id, label, name, autocomplete, toggle = false, meter = false, hint = "", error = "", placeholder = "" }) {
  const shown = toggle && state.auth.showPwd, help = error || hint;
  return `<div class="relative grid gap-1.5"><label for="${id}" class="text-small font-medium text-fg">${label}</label>
    <div class="relative"><input id="${id}" name="${name}" type="${shown ? "text" : "password"}"${meter ? " data-strength" : ""} autocomplete="${autocomplete}"${placeholder ? ` placeholder="${placeholder}"` : ""} class="${inputCls} ${inputLg}${toggle ? " pe-12 md:pe-11" : ""}"${error ? ' aria-invalid="true"' : ""}${help ? ` aria-describedby="${id}-help"` : ""}/>
      ${toggle ? `<span class="absolute inset-y-0 end-1.5 flex items-center"><button type="button" data-action="toggle-pwd" aria-pressed="${shown}" aria-controls="${id}" aria-label="${esc(t("Afficher le mot de passe"))}" title="${esc(shown ? t("Masquer le mot de passe") : t("Afficher le mot de passe"))}" class="${iconBtn("sm", false, "aria-pressed:text-brand-fg")}">${icon("eye")}</button></span>` : ""}</div>
    ${meter ? `<div data-strength-meter>${strengthMeter("")}</div>` : ""}
    ${authHelp(`${id}-help`, hint, error)}</div>`;
}

// Erreur renvoyée par le serveur (ou contrôle local) : alerte en tête de formulaire, dans la langue choisie.
const authError = (msg) => (msg ? alertBox("danger", esc(tServer(msg))) : "");
// Bouton principal : violet sur tous les écrans d'authentification.
const authSubmit = (label) => `<button type="submit" class="${btn("primary", "lg", "w-full")}">${label}</button>`;
const authLinkLine = (text, href, label) => `<p class="mt-6 text-center text-sm text-fg-muted">${text} <a href="${href}" class="${btn("link")}">${label}</a></p>`;
const AUTH_BACK = `inline-flex items-center gap-1.5 rounded-sm text-small font-medium text-fg-muted transition-colors duration-150 hover:text-fg [&_svg]:size-4 [&_svg]:rtl:-scale-x-100 ${FOCUS}`;
// Adresse email, code reçu : saisis de gauche à droite, même en arabe.
const authEmailInput = (value, placeholder, invalid) =>
  `<input name="email" type="email" autocomplete="email" dir="ltr" value="${esc(value)}" placeholder="${placeholder}" class="${inputCls} ${inputLg}"${invalid ? ' aria-invalid="true"' : ""}/>`;
const authCodeInput = (invalid) =>
  `<input name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" dir="ltr" placeholder="000000" class="${inputCls} ${inputLg} font-mono tracking-[0.4em] text-center"${invalid ? ' aria-invalid="true"' : ""}/>`;

// ---------- Saisie gardée d'un rendu à l'autre ----------
// render() remplace tout le DOM : changer de langue ou de type de compte, « Afficher le mot de passe », ouvrir ou fermer
// la connexion simulée, une erreur… vidaient les champs. authLayout() relit le formulaire de la page juste avant le
// rendu et remet ses valeurs dans le formulaire du même nom juste après (jauge du mot de passe comprise). Rien n'est
// repris après resetAuth() (nouvelle page : formulaire vierge), ni les mots de passe après un refus (authDropPwd :
// erreur du serveur, mot de passe trop faible ou différent de sa confirmation). La fenêtre simulée (modale) a le
// brouillon de main.js.
let authFresh = true;
let authDropPwd = false;
function authKeepForms() {
  const fresh = authFresh, dropPwd = authDropPwd;
  authFresh = false; authDropPwd = false;
  if (fresh) return;
  const kept = [...root.querySelectorAll("form[data-form]")].filter((f) => !f.closest('[aria-modal="true"]')).map((f) => ({
    name: f.dataset.form,
    fields: [...f.elements].filter((el) => el.name && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && !/^(hidden|file|submit|button)$/.test(el.type) && !(dropPwd && el.type === "password"))
      .map((el) => ({ name: el.name, check: el.type === "checkbox" || el.type === "radio", value: el.value, checked: el.checked })),
  }));
  if (!kept.length) return;
  queueMicrotask(() => {
    for (const k of kept) {
      const f = [...root.querySelectorAll(`form[data-form="${k.name}"]`)].find((x) => !x.closest('[aria-modal="true"]'));
      if (!f) continue;
      for (const v of k.fields) {
        const el = [...f.elements].find((x) => x.name === v.name && (!v.check || x.value === v.value));
        if (!el) continue;
        if (v.check) el.checked = v.checked;
        else if (el.tagName === "SELECT") { if ([...el.options].some((o) => o.value === v.value)) el.value = v.value; }
        else if (el.value !== v.value) el.value = v.value;
      }
      const meter = f.querySelector("[data-strength-meter]"), pwd = f.querySelector("[data-strength]");
      if (meter && pwd) meter.innerHTML = strengthMeter(pwd.value);
    }
  });
}

// ---------- Connexion ----------

function viewConnexion() {
  const a = state.auth, badEmail = !!a.error && !isEmail(a.email), oauth = authOAuthBlock("login");
  return authLayout(`
    ${authHead(t("Connexion"), oauth ? t("Heureux de vous revoir\u00a0! Connectez-vous pour retrouver votre espace.") : t("Heureux de vous revoir\u00a0! Connectez-vous avec votre adresse email."))}
    <div class="mt-8 grid gap-6">
      ${authOAuthAlert(a.oauthError)}
      ${oauth}
      <form data-form="login" class="grid gap-4" novalidate>
        ${authError(a.error)}
        ${field(t("Adresse email"), authEmailInput(a.email, t("vous@exemple.dz"), badEmail))}
        <div class="grid gap-2">
          ${authPwdField({ id: "auth-password", label: t("Mot de passe"), name: "password", autocomplete: "current-password", toggle: true })}
          <p class="text-end text-small"><a href="#/mot-de-passe" class="${btn("link")}">${t("Mot de passe oublié\u00a0?")}</a></p>
        </div>
        ${authSubmit(t("Se connecter"))}
      </form>
    </div>
    ${authLinkLine(t("Pas encore de compte\u00a0?"), "#/inscription", t("Créer un compte"))}
    ${window.__CLIPBOOST_OFFLINE__ ? demoAccounts() : ""}`);
}

// ---------- Jauge de robustesse du mot de passe ----------

function passwordStrength(pwd) {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd) || pwd.length >= 12) score++;
  return score;
}
const STRENGTH = [["Trop court", "danger"], ["Faible", "danger"], ["Moyen", "warning"], ["Bon", "success"], ["Excellent", "success"]];
const AUTH_STRENGTH_TONE = { danger: ["bg-danger-solid", "text-danger-fg"], warning: ["bg-warning-solid", "text-warning-fg"], success: ["bg-success-solid", "text-success-fg"] };

// Verdicts (STRENGTH) en français, traduits à l'affichage. 4 segments sous le champ ; le verdict s'aligne au bout de la ligne du libellé (conteneur `relative` d'authPwdField).
// Appelé aussi par main.js à chaque frappe dans un champ [data-strength].
function strengthMeter(pwd) {
  const s = pwd ? passwordStrength(pwd) : 0, [label, tone] = STRENGTH[s], [bar, fg] = AUTH_STRENGTH_TONE[tone], lit = pwd ? Math.max(1, s) : 0;
  return `<div class="grid grid-cols-4 gap-1.5" aria-hidden="true">${[1, 2, 3, 4].map((i) => `<span class="h-1 rounded-full transition-colors duration-150 ${i <= lit ? bar : "bg-muted"}"></span>`).join("")}</div>
    ${pwd ? `<span class="absolute end-0 top-0 text-xs font-medium leading-[1.125rem] ${fg}"><span class="sr-only">${t("Robustesse du mot de passe\u00a0:")} </span>${t(label)}</span>` : ""}`;
}

// ---------- Inscription ----------

// Pays : countrySelect() de ui.js, à la hauteur des autres champs (inputLg).
const authCountrySelect = (value, invalid) => countrySelect("country", value, { invalid })
  .replace("block h-10 w-full", `block ${inputLg} w-full`);

// Choix du type de compte : bouton à bascule (aria-pressed) au rendu d'une carte de choix (CHOICE).
const authRoleCard = (value, ic, title, text, on) =>
  `<button type="button" data-action="signup-role" data-value="${value}" aria-pressed="${on}" class="${CHOICE} w-full flex-col text-start aria-pressed:border-brand aria-pressed:bg-brand-soft ${FOCUS}">
    <span class="flex w-full items-center justify-between">
      <span class="grid size-9 place-items-center rounded-tile bg-subtle text-fg-muted transition-colors duration-150 group-aria-pressed:bg-surface group-aria-pressed:text-brand-fg" aria-hidden="true">${icon(ic, "size-[18px]")}</span>
      <span class="grid size-4 place-items-center rounded-full border border-line-control bg-surface transition-colors duration-150 group-aria-pressed:border-brand group-aria-pressed:bg-brand" aria-hidden="true"><span class="size-1.5 rounded-full bg-on-brand opacity-0 group-aria-pressed:opacity-100"></span></span>
    </span>
    <span><span class="block text-sm font-semibold text-fg">${title}</span><span class="mt-0.5 block text-xs text-fg-muted">${text}</span></span></button>`;

// Ordre : type de compte, puis Google / Apple / Discord (avec ce type), puis « ou » et le formulaire email.
function viewInscription() {
  const a = state.auth, f = a.form;
  if (!db.settings.signupsOpen) {
    return authLayout(`<h1 class="sr-only">${t("Créer un compte")}</h1>
      ${emptyState("lock", t("Inscriptions fermées"), t("Les nouvelles inscriptions sont temporairement suspendues par l'équipe ClipBoost. Revenez bientôt\u00a0!"), `<a href="#/connexion" class="${btn("secondary")}">${t("J'ai déjà un compte")}</a>`)}`);
  }
  if (a.step === "code") {
    return authLayout(`
      ${authHead(t("Vérifiez votre email"), t("Nous avons envoyé un code à 6 chiffres à {email}. Pensez à vérifier vos spams\u00a0: le code expire dans 10 minutes.", { email: `<span class="font-medium text-fg" dir="ltr">${esc(f.email)}</span>` }), "mail")}
      ${a.devCode ? `<div class="mt-6">${devCodeNotice(a.devCode)}</div>` : ""}
      <form data-form="verify" class="mt-8 grid gap-4" novalidate>
        ${authError(a.error)}
        ${field(t("Code de vérification"), authCodeInput(!!a.error))}
        ${authSubmit(t("Valider et créer mon compte"))}
      </form>
      <div class="mt-6 flex items-center justify-between gap-4 text-small">
        <button type="button" data-action="signup-back" class="${AUTH_BACK}">${icon("arrowLeft")}${t("Modifier l'email")}</button>
        <button type="button" data-action="resend-code" class="${btn("link")}">${t("Renvoyer le code")}</button>
      </div>`);
  }
  const err = a.fieldErrors || {}, isAgency = f.role === "agence", oauth = authOAuthBlock("signup");
  const inv = (k) => (err[k] ? ' aria-invalid="true"' : "");
  const input = (name, value, autocomplete, extra = "") => `<input name="${name}" value="${esc(value)}" autocomplete="${autocomplete}" class="${inputCls} ${inputLg}"${inv(name)}${extra}/>`;
  return authLayout(`
    ${authHead(t("Créer un compte"), oauth ? t("Inscription gratuite, en moins d'une minute.") : t("Inscription gratuite avec votre adresse email."))}
    <div class="mt-8 grid gap-6">
      <div class="grid gap-4">
        ${authError(a.error)}
        <div class="grid gap-1.5">
          <p class="text-small font-medium text-fg">${t("Je m'inscris en tant que")}</p>
          <div class="grid grid-cols-2 gap-3" role="group" aria-label="${esc(t("Type de compte"))}">
            ${authRoleCard("clipper", "film", t("Clipper"), t("Je publie des clips et je suis payé à la vue."), f.role === "clipper")}
            ${authRoleCard("agence", "building", t("Agence"), t("Je crée des campagnes pour une marque."), isAgency)}
          </div>
        </div>
        ${authReferralNote(f.role)}
      </div>
      ${oauth}
      <form data-form="signup" class="grid gap-4" novalidate>
        ${isAgency
          ? `${field(t("Nom de l'agence ou de la marque"), input("agency", f.agency, "organization"), "", err.agency)}
             ${field(t("Nom du contact"), input("contact", f.contact, "name"), "", err.contact)}`
          : `<div class="grid gap-4 sm:grid-cols-2">
              ${field(t("Prénom"), input("first", f.first, "given-name"), "", err.first)}
              ${field(t("Nom de famille"), input("last", f.last, "family-name"), "", err.last)}
            </div>`}
        ${field(isAgency ? t("Adresse email professionnelle") : t("Adresse email"), authEmailInput(f.email, isAgency ? t("contact@agence.dz") : t("vous@exemple.dz"), !!err.email), "", err.email)}
        ${field(t("Pays"), authCountrySelect(f.country, !!err.country), "", err.country)}
        ${authPwdField({ id: "auth-new-password", label: t("Mot de passe"), name: "password", autocomplete: "new-password", meter: true, hint: t("8 caractères minimum, avec une lettre et un chiffre."), error: err.password })}
        ${authPwdField({ id: "auth-confirm", label: t("Confirmer le mot de passe"), name: "confirm", autocomplete: "new-password", error: err.confirm })}
        <div class="grid gap-1.5">
          <label class="flex items-start gap-3 text-small text-fg-muted"><input name="terms" type="checkbox" ${f.terms ? "checked" : ""} class="${CHECKBOX} mt-px"${inv("terms")}${err.terms ? ' aria-describedby="auth-terms-help"' : ""}/>
            <span>${t("J'accepte les {terms} et la {privacy}.", authLegalLinks())}</span></label>
          ${err.terms ? `<div class="ps-7">${authHelp("auth-terms-help", "", err.terms)}</div>` : ""}
        </div>
        ${authSubmit(t("Recevoir mon code par email"))}
      </form>
    </div>
    ${authLinkLine(t("Déjà inscrit\u00a0?"), "#/connexion", t("Se connecter"))}`);
}

// Conserve la saisie quand on change de type de compte (appelé par main.js juste avant le rendu),
// et rend le focus à la carte choisie au clavier une fois la page réaffichée.
function captureSignupForm() {
  const active = document.activeElement, role = active && active.dataset && active.dataset.action === "signup-role" ? active.dataset.value : "";
  if (role) queueMicrotask(() => { const b = document.querySelector(`[data-action="signup-role"][data-value="${role}"]`); if (b) b.focus(); });
  const form = document.querySelector('[data-form="signup"]');
  if (!form) return;
  const d = Object.fromEntries(new FormData(form)), f = state.auth.form;
  ["first", "last", "agency", "contact", "email", "country"].forEach((k) => { if (k in d) f[k] = d[k]; });
  f.terms = !!d.terms;
}

// En développement (aucun service d'email configuré), le serveur renvoie le code pour pouvoir tester.
// La version autonome (fichier HTML unique) n'envoie jamais d'email : le code est toujours affiché.
const devCodeNotice = (devCode) => alertBox("warning", `<p>${window.__CLIPBOOST_OFFLINE__
  ? t("Mode démo\u00a0: le code a été «\u00a0envoyé\u00a0» par email\u00a0:")
  : t("Mode développement\u00a0: aucun email n'est envoyé. Code\u00a0:")}</p>
  <b class="mt-1 block text-base font-semibold" dir="ltr">${code(devCode)}</b>`).replace('role="note"', 'role="status"');

// Version autonome : comptes d'exemple créés au premier lancement (voir web/offline/seed.ts). label : en français,
// traduit à l'affichage. name : nom du compte,
// repris par la connexion simulée avec Google, Apple ou Discord quand son adresse est saisie.
const AUTH_DEMO = [
  { label: "Admin", name: "Équipe ClipBoost", email: "admin@clipboost.dz", password: "AdminClip2026" },
  { label: "Clipper", name: "Yacine Benali", email: "yacine@clipboost.dz", password: "Clipboost2026" },
  { label: "Agence", name: "Tassili Sport", email: "agence@clipboost.dz", password: "Clipboost2026" },
  { label: "Agence, badge demandé", name: "Hoggar Boissons", email: "hoggar@clipboost.dz", password: "Clipboost2026" },
  { label: "Agence vérifiée", name: "Djurdjura Médias", email: "djurdjura@clipboost.dz", password: "Clipboost2026", verified: true },
];
const demoAccounts = () => `<div class="mt-8">${alertBox("info", `<p class="font-medium">${t("Mode démo\u00a0: les données restent dans ce navigateur.")}</p>
  <ul class="mt-2 grid gap-1.5">${AUTH_DEMO.map((d) => `<li class="flex items-center gap-2">
    <span class="min-w-0 flex-1"><span class="flex items-center gap-1 text-xs">${t(d.label)}${d.verified ? `<span aria-hidden="true">${verifiedBadge("size-3.5")}</span>` : ""}</span><span class="block truncate text-fg" dir="ltr">${code(d.email)}</span></span>
    <button type="button" data-action="auth-copy" data-value="${d.email}" class="${iconBtn("sm")}" aria-label="${esc(t("Copier {email}", { email: d.email }))}" title="${esc(t("Copier"))}">${icon("copy")}</button>
    <button type="button" data-action="auth-demo" data-value="${d.email}" class="${btn("secondary", "sm")}" aria-label="${esc(t("Utiliser le compte {label}", { label: t(d.label) }))}">${t("Utiliser")}</button></li>`).join("")}</ul>
  <p class="mt-2 text-xs">${t("Mot de passe\u00a0: {admin} pour l'admin, {demo} pour les comptes d'exemple.", { admin: code("AdminClip2026"), demo: code("Clipboost2026") })}</p>`)}</div>`;
// « Utiliser » : remplit l'adresse et le mot de passe du compte choisi, puis place le focus sur « Se connecter ».
function authUseDemo(email) {
  const f = document.querySelector('form[data-form="login"]'), acc = AUTH_DEMO.find((d) => d.email === email);
  if (!f || !acc) return;
  f.elements.email.value = acc.email;
  f.elements.password.value = acc.password;
  state.auth.email = acc.email;
  const submit = f.querySelector('button[type="submit"]');
  if (submit) { submit.focus({ preventScroll: true }); submit.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
}

// ---------- Mot de passe oublié ----------

function viewMotDePasse() {
  const a = state.auth;
  if (a.step === "code") {
    return authLayout(`
      ${authHead(t("Nouveau mot de passe"), t("Si un compte existe pour {email}, un code à 6 chiffres vient d'y être envoyé.", { email: `<span class="font-medium text-fg" dir="ltr">${esc(a.email)}</span>` }), "mail")}
      ${a.devCode ? `<div class="mt-6">${devCodeNotice(a.devCode)}</div>` : ""}
      <form data-form="reset" class="mt-8 grid gap-4" novalidate>
        ${authError(a.error)}
        ${field(t("Code reçu par email"), authCodeInput(false))}
        ${authPwdField({ id: "auth-reset-password", label: t("Nouveau mot de passe"), name: "password", autocomplete: "new-password", toggle: true, meter: true, hint: t("8 caractères minimum, avec une lettre et un chiffre.") })}
        ${authSubmit(t("Changer le mot de passe"))}
      </form>
      <div class="mt-6 flex items-center justify-between gap-4 text-small">
        <button type="button" data-action="signup-back" class="${AUTH_BACK}">${icon("arrowLeft")}${t("Modifier l'email")}</button>
        <button type="button" data-action="resend-code" class="${btn("link")}">${t("Renvoyer le code")}</button>
      </div>`);
  }
  const badEmail = !!a.error && !isEmail(a.email);
  return authLayout(`
    ${authHead(t("Mot de passe oublié"), t("Indiquez votre email\u00a0: nous vous enverrons un code pour choisir un nouveau mot de passe."))}
    <form data-form="forgot" class="mt-8 grid gap-4" novalidate>
      ${authError(a.error)}
      ${field(t("Adresse email"), authEmailInput(a.email, t("vous@exemple.dz"), badEmail))}
      ${authSubmit(t("Recevoir un code"))}
    </form>
    <p class="mt-6 text-center text-small"><a href="#/connexion" class="${AUTH_BACK}">${icon("arrowLeft")}${t("Retour à la connexion")}</a></p>`);
}

// ---------- Envoi des formulaires ----------

function signupPayload() {
  const f = state.auth.form;
  return {
    role: f.role, email: f.email, country: f.country, password: state.auth.pendingPassword, terms: true,
    name: f.role === "agence" ? f.agency : `${f.first} ${f.last}`,
    contact: f.role === "agence" ? f.contact : undefined,
    ref: authSignupRef(f.role),
  };
}

async function handleAuthSubmit(form, data) {
  if (form === "auth-oauth") return authOAuthDemo(data);
  const a = state.auth;
  a.error = "";
  try {
    if (form === "login") {
      a.oauthError = null;
      a.email = (data.email || "").trim().toLowerCase();
      if (!isEmail(a.email)) { a.error = t("Saisissez une adresse email valide."); return render(); }
      await api("POST", "/api/auth/login", { email: a.email, password: data.password || "" });
      return enter();
    }
    if (form === "signup") {
      const f = { ...a.form, first: (data.first || "").trim(), last: (data.last || "").trim(), agency: (data.agency || "").trim(), contact: (data.contact || "").trim(), email: (data.email || "").trim().toLowerCase(), country: data.country || "", terms: !!data.terms };
      const err = {};
      if (f.role === "agence") {
        if (!f.agency) err.agency = t("Nom de l'agence requis.");
        if (!f.contact) err.contact = t("Nom du contact requis.");
      } else {
        if (!f.first) err.first = t("Prénom requis.");
        if (!f.last) err.last = t("Nom de famille requis.");
      }
      if (!isEmail(f.email)) err.email = t("Adresse email invalide.");
      if (!f.country) err.country = t("Choisissez votre pays.");
      const pwd = data.password || "";
      if (pwd.length < 8 || !/[a-zA-Z]/.test(pwd) || !/\d/.test(pwd)) err.password = t("8 caractères minimum, avec une lettre et un chiffre.");
      else if (data.confirm !== pwd) err.confirm = t("Les mots de passe ne correspondent pas.");
      if (!f.terms) err.terms = t("Vous devez accepter les conditions.");
      a.form = f; a.fieldErrors = err;
      if (Object.keys(err).length) {
        // Un mot de passe refusé est à ressaisir ; une autre erreur (case non cochée…) ne vide pas les mots de passe.
        authDropPwd = !!(err.password || err.confirm);
        render();
        // Le focus va au premier champ en erreur.
        const el = root.querySelector('[data-form="signup"] [aria-invalid="true"]');
        if (el) el.focus();
        return;
      }
      a.pendingPassword = pwd;
      const res = await api("POST", "/api/auth/signup", signupPayload());
      a.devCode = res.devCode || ""; a.step = "code";
      return render();
    }
    if (form === "verify") {
      await api("POST", "/api/auth/verify", { email: a.form.email, code: (data.code || "").trim() });
      const welcome = a.form.role === "agence" ? a.form.contact.split(" ")[0] : a.form.first;
      return enter(t("Compte créé, bienvenue {name}", { name: welcome }));
    }
    if (form === "forgot") {
      a.email = (data.email || "").trim().toLowerCase();
      if (!isEmail(a.email)) { a.error = t("Saisissez une adresse email valide."); return render(); }
      const res = await api("POST", "/api/auth/forgot", { email: a.email });
      a.devCode = res.devCode || ""; a.step = "code";
      return render();
    }
    if (form === "reset") {
      await api("POST", "/api/auth/reset", { email: a.email, code: (data.code || "").trim(), password: data.password || "" });
      return enter(t("Mot de passe modifié"));
    }
  } catch (e) {
    a.error = e.message;
    // Identifiants refusés (connexion, nouveau mot de passe) : le mot de passe tapé est à ressaisir. À l'inscription,
    // l'erreur du serveur porte sur l'adresse : les mots de passe restent.
    authDropPwd = form === "login" || form === "reset";
    render();
  }
}

// Nouveau code : inscription (étape de vérification) ou mot de passe oublié (étape du nouveau mot de passe).
async function resendCode() {
  try {
    const res = state.route.view === "mot-de-passe"
      ? await api("POST", "/api/auth/forgot", { email: state.auth.email })
      : await api("POST", "/api/auth/signup", signupPayload());
    state.auth.devCode = res.devCode || ""; state.auth.error = "";
    render();
    toast(t("Nouveau code envoyé"));
  } catch (e) {
    toast(tServer(e.message), "danger");
  }
}

// État des écrans de connexion. oauthError : échec d'une connexion Google, Apple ou Discord, repris une seule fois
// (premier appel, au démarrage de l'app) ; formulaire vierge au rendu suivant (authKeepForms).
function resetAuth() {
  state.auth = { email: "", error: "", oauthError: authOAuthPending, showPwd: false, step: "form", form: { role: "clipper", first: "", last: "", agency: "", contact: "", email: "", country: "Algérie", terms: false }, fieldErrors: {}, devCode: "", pendingPassword: "" };
  authOAuthPending = null;
  authFresh = true;
}

// Après connexion ou inscription : charge les données du compte et ouvre son espace.
async function enter(message) {
  await refresh();
  const u = me();
  resetAuth();
  navigate(homeOf(u));
  toast(message || t("Connecté en tant que {name}", { name: u.name }));
}

async function logout() {
  try { await api("POST", "/api/auth/logout"); } catch (e) {}
  await refresh().catch(() => {});
  state.modal = null;
  navigate("#/connexion");
  toast(t("Vous êtes déconnecté"));
}
