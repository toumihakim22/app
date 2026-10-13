// Inscription par email (avec code de vérification envoyé par le serveur), connexion et mot de passe oublié.
// Rendu : docs/design-system.md §6.5. Les helpers propres à ce fichier sont préfixés « auth… ».

// ---------- Mise en page : panneau « night » (≥ lg) + colonne du formulaire ----------

// Garanties réelles, tirées des réglages publics (jamais de chiffres inventés sur l'écran du mot de passe).
function authGuarantees() {
  const s = db.settings;
  return [
    ["wallet", `Retrait dès ${da(s.minWithdraw)} vers BaridiMob, CCP ou RIB`],
    ["shield", s.holdDays > 0 ? `Gains libérés après ${plural(s.holdDays, "jour", "jours")} de contrôle` : "Gains disponibles dès la validation du clip"],
    ["check", "Commission affichée, aucun frais caché"],
  ];
}

function authLayout(content) {
  return `<div class="flex min-h-dvh flex-col bg-surface">${siteBanner()}
  <div class="grid flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
    <aside class="relative hidden overflow-hidden border-r border-night-line bg-night p-12 text-on-brand lg:sticky lg:top-0 lg:flex lg:max-h-dvh lg:flex-col">
      <div class="pointer-events-none absolute -left-24 -top-24 size-96 rounded-full bg-brand/30 blur-3xl" aria-hidden="true"></div>
      <div class="pointer-events-none absolute -bottom-32 -right-16 size-80 rounded-full bg-night-income/15 blur-3xl" aria-hidden="true"></div>
      <div class="relative flex flex-1 flex-col">
        <div>${logo({ tone: "text-on-brand" })}</div>
        <h2 class="mt-auto max-w-md text-h2 text-on-brand text-balance">Vos clips méritent d'être payés.</h2>
        <p class="mt-4 max-w-md text-lg leading-8 text-on-brand/80">Clippers et agences se retrouvent sur ClipBoost${NB}: les uns monétisent leurs vidéos courtes, les autres lancent des campagnes qui touchent tout le public.</p>
        <ul class="mt-10 grid gap-4">${authGuarantees().map(([ic, text]) =>
          `<li class="flex items-center gap-3 text-sm text-on-brand/80"><span class="grid size-8 shrink-0 place-items-center rounded-full bg-on-brand/10 text-on-brand" aria-hidden="true">${icon(ic, "size-4")}</span>${text}</li>`).join("")}</ul>
        <div class="mt-10 opacity-90" aria-hidden="true">${cumulativeChart([0, 2, 1, 4, 3, 6, 5, 8, 9, 7, 11, 12], { h: "h-20", onNight: true, label: "Illustration" })}</div>
        <p class="mt-10 flex items-center gap-2 text-xs text-on-brand/65">© 2026 ClipBoost · Fait en Algérie ${flagDz()}</p>
      </div>
    </aside>
    <div class="flex min-w-0 flex-col px-4 py-6 sm:px-10">
      <header class="flex items-center justify-between gap-3">
        <span class="lg:invisible">${logo({ size: "sm" })}</span>
        <div class="flex items-center gap-1"><a href="/" class="${btn("ghost", "sm")}">${icon("arrowLeft")}Retour au site</a>${themeToggle()}</div>
      </header>
      <main id="main" class="mx-auto mt-6 w-full max-w-sm pb-10 sm:my-auto sm:py-10">${content}</main>
    </div>
  </div></div>`;
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
    <div class="relative"><input id="${id}" name="${name}" type="${shown ? "text" : "password"}"${meter ? " data-strength" : ""} autocomplete="${autocomplete}"${placeholder ? ` placeholder="${placeholder}"` : ""} class="${inputCls} ${inputLg}${toggle ? " pr-12 md:pr-11" : ""}"${error ? ' aria-invalid="true"' : ""}${help ? ` aria-describedby="${id}-help"` : ""}/>
      ${toggle ? `<span class="absolute inset-y-0 right-1.5 flex items-center"><button type="button" data-action="toggle-pwd" aria-pressed="${shown}" aria-controls="${id}" aria-label="Afficher le mot de passe" title="${shown ? "Masquer" : "Afficher"} le mot de passe" class="${iconBtn("sm", false, "aria-pressed:text-brand-fg")}">${icon("eye")}</button></span>` : ""}</div>
    ${meter ? `<div data-strength-meter>${strengthMeter("")}</div>` : ""}
    ${authHelp(`${id}-help`, hint, error)}</div>`;
}

// Erreur renvoyée par le serveur (ou contrôle local) : alerte en tête de formulaire.
const authError = (msg) => (msg ? alertBox("danger", esc(msg)) : "");
// Bouton principal : violet sur tous les écrans d'authentification.
const authSubmit = (label) => `<button type="submit" class="${btn("primary", "lg", "w-full")}">${label}</button>`;
const authLinkLine = (text, href, label) => `<p class="mt-6 text-center text-sm text-fg-muted">${text} <a href="${href}" class="${btn("link")}">${label}</a></p>`;
const AUTH_BACK = `inline-flex items-center gap-1.5 rounded-sm text-small font-medium text-fg-muted transition-colors duration-150 hover:text-fg [&_svg]:size-4 ${FOCUS}`;

// ---------- Connexion ----------

function viewConnexion() {
  const a = state.auth, badEmail = !!a.error && !isEmail(a.email);
  authKeepForm("login");
  return authLayout(`
    ${authHead("Connexion", `Heureux de vous revoir${NB}! Connectez-vous avec votre adresse email.`)}
    <form data-form="login" class="mt-8 grid gap-4" novalidate>
      ${authError(a.error)}
      ${field("Adresse email", `<input name="email" type="email" autocomplete="email" value="${esc(a.email)}" placeholder="vous@exemple.dz" class="${inputCls} ${inputLg}"${badEmail ? ' aria-invalid="true"' : ""}/>`)}
      <div class="grid gap-2">
        ${authPwdField({ id: "auth-password", label: "Mot de passe", name: "password", autocomplete: "current-password", toggle: true })}
        <p class="text-right text-small"><a href="#/mot-de-passe" class="${btn("link")}">Mot de passe oublié${NB}?</a></p>
      </div>
      ${authSubmit("Se connecter")}
    </form>
    ${authLinkLine(`Pas encore de compte${NB}?`, "#/inscription", "Créer un compte")}
    ${window.__CLIPBOOST_OFFLINE__ ? demoAccounts() : ""}`);
}

// « Afficher le mot de passe » réaffiche toute la page : la saisie (adresse, code, mot de passe) et le focus sur le bouton
// sont reportés sur le nouveau formulaire, juste après le rendu. Connexion et nouveau mot de passe.
function authKeepForm(name) {
  const old = document.querySelector(`form[data-form="${name}"]`);
  if (!old || !old.elements.password) return;
  const toggled = old.elements.password.type !== (state.auth.showPwd ? "text" : "password");
  if (!toggled) return;
  const values = [...old.elements].filter((el) => el.name && "value" in el).map((el) => [el.name, el.value]);
  queueMicrotask(() => {
    const f = document.querySelector(`form[data-form="${name}"]`);
    if (!f) return;
    values.forEach(([k, v]) => { if (f.elements[k]) f.elements[k].value = v; });
    const meter = f.querySelector("[data-strength-meter]"), pwd = f.elements.password;
    if (meter && pwd) meter.innerHTML = strengthMeter(pwd.value);
    const t = f.querySelector('[data-action="toggle-pwd"]');
    if (t) t.focus();
  });
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

// 4 segments sous le champ ; le verdict s'aligne à droite de la ligne du libellé (conteneur `relative` d'authPwdField).
// Appelé aussi par main.js à chaque frappe dans un champ [data-strength].
function strengthMeter(pwd) {
  const s = pwd ? passwordStrength(pwd) : 0, [label, tone] = STRENGTH[s], [bar, fg] = AUTH_STRENGTH_TONE[tone], lit = pwd ? Math.max(1, s) : 0;
  return `<div class="grid grid-cols-4 gap-1.5" aria-hidden="true">${[1, 2, 3, 4].map((i) => `<span class="h-1 rounded-full transition-colors duration-150 ${i <= lit ? bar : "bg-muted"}"></span>`).join("")}</div>
    ${pwd ? `<span class="absolute right-0 top-0 text-xs font-medium leading-[1.125rem] ${fg}"><span class="sr-only">Robustesse du mot de passe${NB}: </span>${label}</span>` : ""}`;
}

// ---------- Inscription ----------

// Pays : countrySelect() de ui.js, à la hauteur des autres champs (inputLg).
const authCountrySelect = (value, invalid) => countrySelect("country", value, { invalid })
  .replace("block h-10 w-full", `block ${inputLg} w-full`);

// Choix du type de compte : bouton à bascule (aria-pressed) au rendu d'une carte de choix (CHOICE).
const authRoleCard = (value, ic, title, text, on) =>
  `<button type="button" data-action="signup-role" data-value="${value}" aria-pressed="${on}" class="${CHOICE} w-full flex-col text-left aria-pressed:border-brand aria-pressed:bg-brand-soft ${FOCUS}">
    <span class="flex w-full items-center justify-between">
      <span class="grid size-9 place-items-center rounded-tile bg-subtle text-fg-muted transition-colors duration-150 group-aria-pressed:bg-surface group-aria-pressed:text-brand-fg" aria-hidden="true">${icon(ic, "size-[18px]")}</span>
      <span class="grid size-4 place-items-center rounded-full border border-line-control bg-surface transition-colors duration-150 group-aria-pressed:border-brand group-aria-pressed:bg-brand" aria-hidden="true"><span class="size-1.5 rounded-full bg-on-brand opacity-0 group-aria-pressed:opacity-100"></span></span>
    </span>
    <span><span class="block text-sm font-semibold text-fg">${title}</span><span class="mt-0.5 block text-xs text-fg-muted">${text}</span></span></button>`;

function viewInscription() {
  const a = state.auth, f = a.form;
  if (!db.settings.signupsOpen) {
    return authLayout(`<h1 class="sr-only">Créer un compte</h1>
      ${emptyState("lock", "Inscriptions fermées", `Les nouvelles inscriptions sont temporairement suspendues par l'équipe ClipBoost. Revenez bientôt${NB}!`, `<a href="#/connexion" class="${btn("secondary")}">J'ai déjà un compte</a>`)}`);
  }
  if (a.step === "code") {
    return authLayout(`
      ${authHead("Vérifiez votre email", `Nous avons envoyé un code à 6 chiffres à <span class="font-medium text-fg">${esc(f.email)}</span>. Pensez à vérifier vos spams${NB}: le code expire dans 10 minutes.`, "mail")}
      ${a.devCode ? `<div class="mt-6">${devCodeNotice(a.devCode)}</div>` : ""}
      <form data-form="verify" class="mt-8 grid gap-4" novalidate>
        ${authError(a.error)}
        ${field("Code de vérification", `<input name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000" class="${inputCls} ${inputLg} font-mono tracking-[0.4em] text-center"${a.error ? ' aria-invalid="true"' : ""}/>`)}
        ${authSubmit("Valider et créer mon compte")}
      </form>
      <div class="mt-6 flex items-center justify-between gap-4 text-small">
        <button type="button" data-action="signup-back" class="${AUTH_BACK}">${icon("arrowLeft")}Modifier l'email</button>
        <button type="button" data-action="resend-code" class="${btn("link")}">Renvoyer le code</button>
      </div>`);
  }
  const err = a.fieldErrors || {}, isAgency = f.role === "agence";
  const inv = (k) => (err[k] ? ' aria-invalid="true"' : "");
  const input = (name, value, autocomplete, extra = "") => `<input name="${name}" value="${esc(value)}" autocomplete="${autocomplete}" class="${inputCls} ${inputLg}"${inv(name)}${extra}/>`;
  return authLayout(`
    ${authHead("Créer un compte", "Inscription gratuite avec votre adresse email.")}
    <div class="mt-8 grid gap-4">
      ${authError(a.error)}
      <div class="grid gap-1.5">
        <p class="text-small font-medium text-fg">Je m'inscris en tant que</p>
        <div class="grid grid-cols-2 gap-3" role="group" aria-label="Type de compte">
          ${authRoleCard("clipper", "film", "Clipper", "Je publie des clips et je suis payé à la vue.", f.role === "clipper")}
          ${authRoleCard("agence", "building", "Agence", "Je crée des campagnes pour une marque.", isAgency)}
        </div>
      </div>
    </div>
    <form data-form="signup" class="mt-6 grid gap-4" novalidate>
      ${isAgency
        ? `${field("Nom de l'agence ou de la marque", input("agency", f.agency, "organization"), "", err.agency)}
           ${field("Nom du contact", input("contact", f.contact, "name"), "", err.contact)}`
        : `<div class="grid gap-4 sm:grid-cols-2">
            ${field("Prénom", input("first", f.first, "given-name"), "", err.first)}
            ${field("Nom", input("last", f.last, "family-name"), "", err.last)}
          </div>`}
      ${field(`Adresse email${isAgency ? " professionnelle" : ""}`, input("email", f.email, "email", ` type="email" placeholder="${isAgency ? "contact@agence.dz" : "vous@exemple.dz"}"`), "", err.email)}
      ${field("Pays", authCountrySelect(f.country, !!err.country), "", err.country)}
      ${authPwdField({ id: "auth-new-password", label: "Mot de passe", name: "password", autocomplete: "new-password", meter: true, hint: "8 caractères minimum, avec une lettre et un chiffre.", error: err.password })}
      ${authPwdField({ id: "auth-confirm", label: "Confirmer le mot de passe", name: "confirm", autocomplete: "new-password", error: err.confirm })}
      <div class="grid gap-1.5">
        <label class="flex items-start gap-3 text-small text-fg-muted"><input name="terms" type="checkbox" ${f.terms ? "checked" : ""} class="${CHECKBOX} mt-px"${inv("terms")}${err.terms ? ' aria-describedby="auth-terms-help"' : ""}/>
          <span>J'accepte les <a href="/#conditions" target="_blank" rel="noopener" class="${btn("link")}">conditions d'utilisation</a> et la <a href="/#confidentialite" target="_blank" rel="noopener" class="${btn("link")}">politique de confidentialité</a>.</span></label>
        ${err.terms ? `<div class="pl-7">${authHelp("auth-terms-help", "", err.terms)}</div>` : ""}
      </div>
      ${authSubmit("Recevoir mon code par email")}
    </form>
    ${authLinkLine(`Déjà inscrit${NB}?`, "#/connexion", "Se connecter")}`);
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
  ? `Mode démo${NB}: le code a été «${NB}envoyé${NB}» par email${NB}:`
  : `Mode développement${NB}: aucun email n'est envoyé. Code${NB}:`}</p>
  <b class="mt-1 block text-base font-semibold">${code(devCode)}</b>`).replace('role="note"', 'role="status"');

// Version autonome : comptes d'exemple créés au premier lancement (voir web/offline/seed.ts).
const AUTH_DEMO = [["Admin", "admin@clipboost.dz", "AdminClip2026"], ["Clipper", "yacine@clipboost.dz", "Clipboost2026"], ["Agence", "agence@clipboost.dz", "Clipboost2026"]];
const demoAccounts = () => `<div class="mt-8">${alertBox("info", `<p class="font-medium">Mode démo${NB}: les données restent dans ce navigateur.</p>
  <ul class="mt-2 grid gap-1.5">${AUTH_DEMO.map(([role, email]) => `<li class="flex items-center gap-2">
    <span class="min-w-0 flex-1"><span class="block text-xs">${role}</span><span class="block truncate text-fg">${code(email)}</span></span>
    <button type="button" data-action="auth-copy" data-value="${email}" class="${iconBtn("sm")}" aria-label="Copier ${email}" title="Copier">${icon("copy")}</button>
    <button type="button" data-action="auth-demo" data-value="${email}" class="${btn("secondary", "sm")}" aria-label="Utiliser le compte ${role}">Utiliser</button></li>`).join("")}</ul>
  <p class="mt-2 text-xs">Mot de passe${NB}: ${code("AdminClip2026")} pour l'admin, ${code("Clipboost2026")} pour les comptes d'exemple.</p>`)}</div>`;
// « Utiliser » : remplit l'adresse et le mot de passe du compte choisi, puis place le focus sur « Se connecter ».
function authUseDemo(email) {
  const f = document.querySelector('form[data-form="login"]'), acc = AUTH_DEMO.find((a) => a[1] === email);
  if (!f || !acc) return;
  f.elements.email.value = acc[1];
  f.elements.password.value = acc[2];
  state.auth.email = acc[1];
  const submit = f.querySelector('button[type="submit"]');
  if (submit) { submit.focus({ preventScroll: true }); submit.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
}

// ---------- Mot de passe oublié ----------

function viewMotDePasse() {
  const a = state.auth;
  if (a.step === "code") {
    authKeepForm("reset");
    return authLayout(`
      ${authHead("Nouveau mot de passe", `Si un compte existe pour <span class="font-medium text-fg">${esc(a.email)}</span>, un code à 6 chiffres vient d'y être envoyé.`, "mail")}
      ${a.devCode ? `<div class="mt-6">${devCodeNotice(a.devCode)}</div>` : ""}
      <form data-form="reset" class="mt-8 grid gap-4" novalidate>
        ${authError(a.error)}
        ${field("Code reçu par email", `<input name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000" class="${inputCls} ${inputLg} font-mono tracking-[0.4em] text-center"/>`)}
        ${authPwdField({ id: "auth-reset-password", label: "Nouveau mot de passe", name: "password", autocomplete: "new-password", toggle: true, meter: true, hint: "8 caractères minimum, avec une lettre et un chiffre." })}
        ${authSubmit("Changer le mot de passe")}
      </form>
      <div class="mt-6 flex items-center justify-between gap-4 text-small">
        <button type="button" data-action="signup-back" class="${AUTH_BACK}">${icon("arrowLeft")}Modifier l'email</button>
        <button type="button" data-action="resend-code" class="${btn("link")}">Renvoyer le code</button>
      </div>`);
  }
  const badEmail = !!a.error && !isEmail(a.email);
  return authLayout(`
    ${authHead("Mot de passe oublié", `Indiquez votre email${NB}: nous vous enverrons un code pour choisir un nouveau mot de passe.`)}
    <form data-form="forgot" class="mt-8 grid gap-4" novalidate>
      ${authError(a.error)}
      ${field("Adresse email", `<input name="email" type="email" autocomplete="email" value="${esc(a.email)}" placeholder="vous@exemple.dz" class="${inputCls} ${inputLg}"${badEmail ? ' aria-invalid="true"' : ""}/>`)}
      ${authSubmit("Recevoir un code")}
    </form>
    <p class="mt-6 text-center text-small"><a href="#/connexion" class="${AUTH_BACK}">${icon("arrowLeft")}Retour à la connexion</a></p>`);
}

// ---------- Envoi des formulaires ----------

function signupPayload() {
  const f = state.auth.form;
  return {
    role: f.role, email: f.email, country: f.country, password: state.auth.pendingPassword, terms: true,
    name: f.role === "agence" ? f.agency : `${f.first} ${f.last}`,
    contact: f.role === "agence" ? f.contact : undefined,
  };
}

async function handleAuthSubmit(form, data) {
  const a = state.auth;
  a.error = "";
  try {
    if (form === "login") {
      a.email = (data.email || "").trim().toLowerCase();
      if (!isEmail(a.email)) { a.error = "Saisissez une adresse email valide."; return render(); }
      await api("POST", "/api/auth/login", { email: a.email, password: data.password || "" });
      return enter();
    }
    if (form === "signup") {
      const f = { ...a.form, first: (data.first || "").trim(), last: (data.last || "").trim(), agency: (data.agency || "").trim(), contact: (data.contact || "").trim(), email: (data.email || "").trim().toLowerCase(), country: data.country || "", terms: !!data.terms };
      const err = {};
      if (f.role === "agence") {
        if (!f.agency) err.agency = "Nom de l'agence requis.";
        if (!f.contact) err.contact = "Nom du contact requis.";
      } else {
        if (!f.first) err.first = "Prénom requis.";
        if (!f.last) err.last = "Nom requis.";
      }
      if (!isEmail(f.email)) err.email = "Adresse email invalide.";
      if (!f.country) err.country = "Choisissez votre pays.";
      const pwd = data.password || "";
      if (pwd.length < 8 || !/[a-zA-Z]/.test(pwd) || !/\d/.test(pwd)) err.password = "8 caractères minimum, avec une lettre et un chiffre.";
      else if (data.confirm !== pwd) err.confirm = "Les mots de passe ne correspondent pas.";
      if (!f.terms) err.terms = "Vous devez accepter les conditions.";
      a.form = f; a.fieldErrors = err;
      if (Object.keys(err).length) {
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
      return enter(`Compte créé, bienvenue ${welcome}`);
    }
    if (form === "forgot") {
      a.email = (data.email || "").trim().toLowerCase();
      if (!isEmail(a.email)) { a.error = "Saisissez une adresse email valide."; return render(); }
      const res = await api("POST", "/api/auth/forgot", { email: a.email });
      a.devCode = res.devCode || ""; a.step = "code";
      return render();
    }
    if (form === "reset") {
      await api("POST", "/api/auth/reset", { email: a.email, code: (data.code || "").trim(), password: data.password || "" });
      return enter("Mot de passe modifié");
    }
  } catch (e) {
    a.error = e.message;
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
    toast("Nouveau code envoyé");
  } catch (e) {
    toast(e.message, "danger");
  }
}

function resetAuth() {
  state.auth = { email: "", error: "", showPwd: false, step: "form", form: { role: "clipper", first: "", last: "", agency: "", contact: "", email: "", country: "Algérie", terms: false }, fieldErrors: {}, devCode: "", pendingPassword: "" };
}

// Après connexion ou inscription : charge les données du compte et ouvre son espace.
async function enter(message) {
  await refresh();
  const u = me();
  resetAuth();
  navigate(homeOf(u));
  toast(message || `Connecté en tant que ${u.name}`);
}

async function logout() {
  try { await api("POST", "/api/auth/logout"); } catch (e) {}
  await refresh().catch(() => {});
  state.modal = null;
  navigate("#/connexion");
  toast("Vous êtes déconnecté");
}
