// Inscription par email (avec code de vérification envoyé par le serveur), connexion et mot de passe oublié.

function authLayout(content) {
  return `${siteBanner()}
  <div class="grid min-h-screen lg:grid-cols-2">
    <div class="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col">
      ${logo(true)}
      <div class="pointer-events-none absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-brand-600/40 blur-3xl"></div>
      <div class="pointer-events-none absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-income/40 blur-3xl"></div>
      <div class="relative my-auto max-w-md">
        <h2 class="text-4xl font-extrabold leading-tight">Transformez vos clips en revenus.</h2>
        <p class="mt-4 text-lg text-white/70">Clippers et agences se retrouvent sur ClipBoost : les uns monétisent leurs vidéos courtes, les autres lancent des campagnes qui touchent tout le public.</p>
        <div class="mt-10 rounded-3xl bg-white p-6 text-ink shadow-2xl">
          <div class="flex items-start justify-between"><div><p class="text-sm font-medium text-gray-600">Revenus</p><p class="mt-1 text-3xl font-extrabold">998 500 DA</p>
          <p class="mt-1 text-sm text-gray-600">${icon("trend", "mr-1 inline h-4 w-4")}<b>+8,2 %</b> ce mois-ci</p></div>
          <span class="grid h-12 w-12 place-items-center rounded-full bg-income text-white">${icon("arrowUp")}</span></div>
          <div class="mt-3 h-20">${areaChart([8, 9, 12, 18, 24, 27, 27, 26, 29, 33, 35, 33, 27])}</div>
        </div>
      </div>
      <p class="relative text-sm text-white/50">© 2026 ClipBoost · Fait en Algérie 🇩🇿</p>
    </div>
    <div class="flex flex-col px-4 py-8 sm:px-10">
      <div class="flex items-center justify-between gap-3 lg:justify-end"><span class="lg:hidden">${logo()}</span><div class="flex items-center gap-3"><a href="/" class="text-sm font-semibold text-gray-500 hover:text-ink">← Retour au site</a>${themeToggle()}</div></div>
      <div class="mx-auto my-auto w-full max-w-md py-10">${content}</div>
    </div>
  </div>`;
}

const errorBox = (msg) => (msg ? `<div class="mb-5 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-100" role="alert">${msg}</div>` : "");

function viewConnexion() {
  const a = state.auth;
  return authLayout(`
    <h1 class="text-3xl font-extrabold tracking-tight">Connexion</h1>
    <p class="mt-2 text-gray-500">Heureux de vous revoir ! Connectez-vous avec votre email.</p>
    <div class="mt-8">${errorBox(a.error)}
      <form data-form="login" class="space-y-4" novalidate>
        ${field("Adresse email", `<input name="email" type="email" autocomplete="email" value="${esc(a.email)}" placeholder="vous@exemple.dz" class="${inputCls}"/>`)}
        ${field("Mot de passe", `<div class="relative"><input name="password" type="${a.showPwd ? "text" : "password"}" autocomplete="current-password" placeholder="••••••••" class="${inputCls} pr-12"/>
          <button type="button" data-action="toggle-pwd" class="absolute right-3 top-1/2 mt-0.5 -translate-y-1/2 text-gray-400 hover:text-ink" aria-label="${a.showPwd ? "Masquer" : "Afficher"} le mot de passe">${icon("eye", "h-5 w-5")}</button></div>`)}
        <div class="text-right text-sm"><a href="#/mot-de-passe" class="font-semibold text-brand-700 hover:underline">Mot de passe oublié ?</a></div>
        <button class="w-full rounded-2xl bg-ink py-3.5 font-semibold text-white transition hover:bg-black">Se connecter</button>
      </form>
      <p class="mt-6 text-center text-sm text-gray-500">Pas encore de compte ? <a href="#/inscription" class="font-semibold text-brand-700 hover:underline">Créer un compte</a></p>
    </div>`);
}

function passwordStrength(pwd) {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd) || pwd.length >= 12) score++;
  return score;
}
const STRENGTH = [["Trop court", "bg-rose-500"], ["Faible", "bg-rose-500"], ["Moyen", "bg-amber-400"], ["Bon", "bg-emerald-500"], ["Excellent", "bg-emerald-600"]];

function strengthMeter(pwd) {
  const s = pwd ? passwordStrength(pwd) : 0, [label, color] = STRENGTH[s];
  return `<div class="mt-2 flex items-center gap-3"><div class="grid flex-1 grid-cols-4 gap-1">${[1, 2, 3, 4].map((i) => `<span class="h-1.5 rounded-full ${i <= s ? color : "bg-gray-200"}"></span>`).join("")}</div>
    <span class="w-20 text-right text-xs font-medium text-gray-500">${pwd ? label : "8 car. min."}</span></div>`;
}

function viewInscription() {
  const a = state.auth, f = a.form;
  if (!db.settings.signupsOpen) {
    return authLayout(`<div class="text-center"><p class="text-5xl">🔒</p><h1 class="mt-4 text-3xl font-extrabold">Inscriptions fermées</h1>
      <p class="mt-3 text-gray-500">Les nouvelles inscriptions sont temporairement suspendues par l'équipe ClipBoost. Revenez bientôt !</p>
      <a href="#/connexion" class="mt-8 inline-block rounded-2xl bg-ink px-6 py-3.5 font-semibold text-white">J'ai déjà un compte</a></div>`);
  }
  if (a.step === "code") {
    return authLayout(`
      <span class="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">${icon("mail", "h-7 w-7")}</span>
      <h1 class="mt-6 text-3xl font-extrabold tracking-tight">Vérifiez votre email</h1>
      <p class="mt-2 text-gray-500">Nous avons envoyé un code à 6 chiffres à <b class="text-ink">${esc(f.email)}</b>.</p>
      <p class="mt-3 text-sm text-gray-500">Pensez à vérifier vos spams. Le code expire dans 10 minutes.</p>
      ${a.devCode ? devCodeNotice(a.devCode) : ""}
      <div class="mt-6">${errorBox(a.error)}
        <form data-form="verify" class="space-y-4" novalidate>
          ${field("Code de vérification", `<input name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000" class="${inputCls} text-center text-2xl font-bold tracking-[0.5em]"/>`)}
          <button class="w-full rounded-2xl bg-ink py-3.5 font-semibold text-white hover:bg-black">Valider et créer mon compte</button>
        </form>
        <div class="mt-5 flex justify-between text-sm"><button type="button" data-action="signup-back" class="font-semibold text-gray-500 hover:text-ink">← Modifier l'email</button>
          <button type="button" data-action="resend-code" class="font-semibold text-brand-700 hover:underline">Renvoyer le code</button></div>
      </div>`);
  }
  const err = a.fieldErrors || {};
  const fe = (k) => (err[k] ? `<span class="mt-1 block text-xs font-medium text-rose-600">${err[k]}</span>` : "");
  const ring = (k) => (err[k] ? " border-rose-300 focus:border-rose-500 focus:ring-rose-100" : "");
  const isAgency = f.role === "agence";
  const roleCard = (value, emoji, title, text) => `<button type="button" data-action="signup-role" data-value="${value}" aria-pressed="${f.role === value}"
    class="rounded-2xl p-4 text-left ring-1 transition ${f.role === value ? "bg-brand-50 ring-2 ring-brand-500" : "bg-white ring-gray-200 hover:ring-brand-500"}">
    <span class="text-2xl">${emoji}</span><span class="mt-2 block font-bold">${title}</span><span class="mt-0.5 block text-xs text-gray-500">${text}</span></button>`;
  return authLayout(`
    <h1 class="text-3xl font-extrabold tracking-tight">Créer un compte</h1>
    <p class="mt-2 text-gray-500">Inscription gratuite avec votre adresse email.</p>
    <div class="mt-8">${errorBox(a.error)}
      <p class="mb-2 text-sm font-medium text-gray-700">Je m'inscris en tant que</p>
      <div class="mb-6 grid grid-cols-2 gap-3" role="group" aria-label="Type de compte">
        ${roleCard("clipper", "🎬", "Clipper", "Je publie des clips et je suis payé à la vue.")}
        ${roleCard("agence", "🏢", "Agence", "Je crée des campagnes pour une marque.")}
      </div>
      <form data-form="signup" class="space-y-4" novalidate>
        ${isAgency
          ? `<label class="block text-sm"><span class="font-medium text-gray-700">Nom de l'agence ou de la marque</span><input name="agency" value="${esc(f.agency)}" autocomplete="organization" class="${inputCls}${ring("agency")}"/>${fe("agency")}</label>
             <label class="block text-sm"><span class="font-medium text-gray-700">Nom du contact</span><input name="contact" value="${esc(f.contact)}" autocomplete="name" class="${inputCls}${ring("contact")}"/>${fe("contact")}</label>`
          : `<div class="grid gap-4 sm:grid-cols-2">
              <label class="block text-sm"><span class="font-medium text-gray-700">Prénom</span><input name="first" value="${esc(f.first)}" autocomplete="given-name" class="${inputCls}${ring("first")}"/>${fe("first")}</label>
              <label class="block text-sm"><span class="font-medium text-gray-700">Nom</span><input name="last" value="${esc(f.last)}" autocomplete="family-name" class="${inputCls}${ring("last")}"/>${fe("last")}</label>
            </div>`}
        <label class="block text-sm"><span class="font-medium text-gray-700">Adresse email${isAgency ? " professionnelle" : ""}</span><input name="email" type="email" value="${esc(f.email)}" autocomplete="email" placeholder="${isAgency ? "contact@agence.dz" : "vous@exemple.dz"}" class="${inputCls}${ring("email")}"/>${fe("email")}</label>
        <label class="block text-sm"><span class="font-medium text-gray-700">Pays</span>${countrySelect("country", f.country, inputCls + ring("country"))}${fe("country")}</label>
        <label class="block text-sm"><span class="font-medium text-gray-700">Mot de passe</span><input name="password" type="password" data-strength autocomplete="new-password" class="${inputCls}${ring("password")}"/><span data-strength-meter>${strengthMeter("")}</span>${fe("password")}</label>
        <label class="block text-sm"><span class="font-medium text-gray-700">Confirmer le mot de passe</span><input name="confirm" type="password" autocomplete="new-password" class="${inputCls}${ring("confirm")}"/>${fe("confirm")}</label>
        <label class="flex items-start gap-3 text-sm text-gray-600"><input name="terms" type="checkbox" ${f.terms ? "checked" : ""} class="mt-0.5 h-4 w-4 accent-brand-600"/><span>J'accepte les <a href="#/inscription" class="font-semibold text-brand-700">conditions d'utilisation</a> et la politique de confidentialité.${fe("terms")}</span></label>
        <button class="w-full rounded-2xl bg-brand-600 py-3.5 font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700">Recevoir mon code par email</button>
      </form>
      <p class="mt-6 text-center text-sm text-gray-500">Déjà inscrit ? <a href="#/connexion" class="font-semibold text-brand-700 hover:underline">Se connecter</a></p>
    </div>`);
}

// Conserve la saisie quand on change de type de compte.
function captureSignupForm() {
  const form = document.querySelector('[data-form="signup"]');
  if (!form) return;
  const d = Object.fromEntries(new FormData(form)), f = state.auth.form;
  ["first", "last", "agency", "contact", "email", "country"].forEach((k) => { if (k in d) f[k] = d[k]; });
  f.terms = !!d.terms;
}

// En développement (aucun service d'email configuré), le serveur renvoie le code pour pouvoir tester.
const devCodeNotice = (code) => `<div role="status" class="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-100">Mode développement : aucun email n'est envoyé. Code : <b class="tracking-widest">${code}</b></div>`;

function viewMotDePasse() {
  const a = state.auth;
  if (a.step === "code") {
    return authLayout(`
      <h1 class="text-3xl font-extrabold tracking-tight">Nouveau mot de passe</h1>
      <p class="mt-2 text-gray-500">Si un compte existe pour <b class="text-ink">${esc(a.email)}</b>, un code à 6 chiffres vient d'y être envoyé.</p>
      ${a.devCode ? devCodeNotice(a.devCode) : ""}
      <div class="mt-6">${errorBox(a.error)}
        <form data-form="reset" class="space-y-4" novalidate>
          ${field("Code reçu par email", `<input name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000" class="${inputCls} text-center text-2xl font-bold tracking-[0.5em]"/>`)}
          <label class="block text-sm"><span class="font-medium text-gray-700">Nouveau mot de passe</span><input name="password" type="password" data-strength autocomplete="new-password" class="${inputCls}"/><span data-strength-meter>${strengthMeter("")}</span></label>
          <button class="w-full rounded-2xl bg-ink py-3.5 font-semibold text-white hover:bg-black">Changer le mot de passe</button>
        </form>
      </div>`);
  }
  return authLayout(`
    <h1 class="text-3xl font-extrabold tracking-tight">Mot de passe oublié</h1>
    <p class="mt-2 text-gray-500">Indiquez votre email : nous vous enverrons un code pour choisir un nouveau mot de passe.</p>
    <div class="mt-8">${errorBox(a.error)}
      <form data-form="forgot" class="space-y-4" novalidate>
        ${field("Adresse email", `<input name="email" type="email" autocomplete="email" value="${esc(a.email)}" class="${inputCls}"/>`)}
        <button class="w-full rounded-2xl bg-ink py-3.5 font-semibold text-white hover:bg-black">Recevoir un code</button>
      </form>
      <p class="mt-6 text-center text-sm"><a href="#/connexion" class="font-semibold text-brand-700 hover:underline">← Retour à la connexion</a></p>
    </div>`);
}

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
      if (!f.terms) err.terms = " Vous devez accepter les conditions.";
      a.form = f; a.fieldErrors = err;
      if (Object.keys(err).length) return render();
      a.pendingPassword = pwd;
      const res = await api("POST", "/api/auth/signup", signupPayload());
      a.devCode = res.devCode || ""; a.step = "code";
      return render();
    }
    if (form === "verify") {
      await api("POST", "/api/auth/verify", { email: a.form.email, code: (data.code || "").trim() });
      const welcome = a.form.role === "agence" ? a.form.contact.split(" ")[0] : a.form.first;
      return enter(`Compte créé, bienvenue ${welcome} 🎉`);
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
      return enter("Mot de passe modifié ✓");
    }
  } catch (e) {
    a.error = e.message;
    render();
  }
}

async function resendCode() {
  try {
    const res = await api("POST", "/api/auth/signup", signupPayload());
    state.auth.devCode = res.devCode || ""; state.auth.error = "";
    render();
    toast("Nouveau code envoyé");
  } catch (e) {
    toast(e.message);
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
  toast("Vous êtes déconnecté.");
}
