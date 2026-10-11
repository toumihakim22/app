// Inscription par email (avec code de vérification simulé) et connexion.
// Aucune donnée ne quitte le navigateur : les comptes vivent en mémoire le temps de la visite.

function authLayout(content) {
  return `${siteBanner()}
  <div class="grid min-h-screen lg:grid-cols-2">
    <div class="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col">
      ${logo(true)}
      <div class="pointer-events-none absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-brand-600/40 blur-3xl"></div>
      <div class="pointer-events-none absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-income/40 blur-3xl"></div>
      <div class="relative my-auto max-w-md">
        <h2 class="text-4xl font-extrabold leading-tight">Transformez vos clips en revenus.</h2>
        <p class="mt-4 text-lg text-white/70">Rejoignez plus de 12 400 clippers qui monétisent leurs vidéos courtes avec les marques algériennes.</p>
        <div class="mt-10 rounded-3xl bg-white p-6 text-ink shadow-2xl">
          <div class="flex items-start justify-between"><div><p class="text-sm font-medium text-gray-600">Revenus</p><p class="mt-1 text-3xl font-extrabold">998 500 DA</p>
          <p class="mt-1 text-sm text-gray-600">${icon("trend", "mr-1 inline h-4 w-4")}<b>+8,2 %</b> ce mois-ci</p></div>
          <span class="grid h-12 w-12 place-items-center rounded-full bg-income text-white">${icon("arrowUp")}</span></div>
          <div class="mt-3 h-20">${areaChart(income12)}</div>
        </div>
      </div>
      <p class="relative text-sm text-white/50">Démonstration : comptes et données fictifs.</p>
    </div>
    <div class="flex flex-col px-4 py-8 sm:px-10">
      <div class="flex items-center justify-between lg:justify-end"><span class="lg:hidden">${logo()}</span><a href="#/" class="text-sm font-semibold text-gray-500 hover:text-ink">← Retour au site</a></div>
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
        <div class="flex items-center justify-between text-sm"><label class="flex items-center gap-2 text-gray-600"><input type="checkbox" checked class="accent-brand-600"/> Se souvenir de moi</label>
          <button type="button" data-action="forgot" class="font-semibold text-brand-700 hover:underline">Mot de passe oublié ?</button></div>
        <button class="w-full rounded-2xl bg-ink py-3.5 font-semibold text-white transition hover:bg-black">Se connecter</button>
      </form>
      <p class="mt-6 text-center text-sm text-gray-500">Pas encore de compte ? <a href="#/inscription" class="font-semibold text-brand-700 hover:underline">Créer un compte</a></p>
      <div class="mt-8 rounded-2xl bg-gray-50 p-4 ring-1 ring-gray-100">
        <p class="text-xs font-semibold uppercase tracking-widest text-gray-400">Comptes de démonstration</p>
        <div class="mt-3 grid gap-2 sm:grid-cols-2">
          <button type="button" data-action="demo-login" data-email="yacine@clipboost.dz" class="rounded-xl bg-white px-3 py-2.5 text-left text-sm ring-1 ring-gray-200 hover:ring-brand-500"><b>Clipper</b><br/><span class="text-gray-500">yacine@clipboost.dz</span></button>
          <button type="button" data-action="demo-login" data-email="admin@clipboost.dz" class="rounded-xl bg-white px-3 py-2.5 text-left text-sm ring-1 ring-gray-200 hover:ring-brand-500"><b>Administrateur</b><br/><span class="text-gray-500">admin@clipboost.dz</span></button>
        </div>
        <p class="mt-2 text-xs text-gray-500">Mots de passe : <code>clipper123</code> et <code>admin123</code>.</p>
      </div>
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
    <span class="w-20 text-right text-xs font-medium text-gray-500">${pwd ? label : "8 caractères min."}</span></div>`;
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
      <div class="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-100">Démonstration : aucun email n'est réellement envoyé. Votre code est <b class="tracking-widest">${a.code}</b>.</div>
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
  return authLayout(`
    <h1 class="text-3xl font-extrabold tracking-tight">Créer un compte Clipper</h1>
    <p class="mt-2 text-gray-500">Inscription gratuite avec votre adresse email.</p>
    <div class="mt-8">${errorBox(a.error)}
      <form data-form="signup" class="space-y-4" novalidate>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block text-sm"><span class="font-medium text-gray-700">Prénom</span><input name="first" value="${esc(f.first)}" autocomplete="given-name" class="${inputCls}${ring("first")}"/>${fe("first")}</label>
          <label class="block text-sm"><span class="font-medium text-gray-700">Nom</span><input name="last" value="${esc(f.last)}" autocomplete="family-name" class="${inputCls}${ring("last")}"/>${fe("last")}</label>
        </div>
        <label class="block text-sm"><span class="font-medium text-gray-700">Adresse email</span><input name="email" type="email" value="${esc(f.email)}" autocomplete="email" placeholder="vous@exemple.dz" class="${inputCls}${ring("email")}"/>${fe("email")}</label>
        <label class="block text-sm"><span class="font-medium text-gray-700">Wilaya</span><select name="city" class="${inputCls}${ring("city")}"><option value="">Choisir…</option>${WILAYAS.map((w) => `<option ${w === f.city ? "selected" : ""}>${w}</option>`).join("")}</select>${fe("city")}</label>
        <label class="block text-sm"><span class="font-medium text-gray-700">Mot de passe</span><input name="password" type="password" data-strength autocomplete="new-password" class="${inputCls}${ring("password")}"/><span data-strength-meter>${strengthMeter("")}</span>${fe("password")}</label>
        <label class="block text-sm"><span class="font-medium text-gray-700">Confirmer le mot de passe</span><input name="confirm" type="password" autocomplete="new-password" class="${inputCls}${ring("confirm")}"/>${fe("confirm")}</label>
        <label class="flex items-start gap-3 text-sm text-gray-600"><input name="terms" type="checkbox" ${f.terms ? "checked" : ""} class="mt-0.5 h-4 w-4 accent-brand-600"/><span>J'accepte les <a href="#/inscription" class="font-semibold text-brand-700">conditions d'utilisation</a> et la politique de confidentialité.${fe("terms")}</span></label>
        <button class="w-full rounded-2xl bg-brand-600 py-3.5 font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700">Recevoir mon code par email</button>
      </form>
      <p class="mt-6 text-center text-sm text-gray-500">Déjà inscrit ? <a href="#/connexion" class="font-semibold text-brand-700 hover:underline">Se connecter</a></p>
    </div>`);
}

function newCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function handleAuthSubmit(form, data) {
  const a = state.auth;
  if (form === "login") {
    const email = (data.email || "").trim().toLowerCase();
    a.email = email;
    const u = db.users.find((x) => x.email === email);
    if (!isEmail(email)) a.error = "Saisissez une adresse email valide.";
    else if (!u || u.password !== data.password) a.error = "Email ou mot de passe incorrect.";
    else if (u.status === "Suspendu") a.error = "Ce compte est suspendu. Contactez le support ClipBoost.";
    else if (db.settings.maintenance && u.role !== "admin") a.error = "Le site est en maintenance : les connexions Clipper sont temporairement suspendues.";
    else return login(u);
    return render();
  }
  if (form === "signup") {
    const f = { first: (data.first || "").trim(), last: (data.last || "").trim(), email: (data.email || "").trim().toLowerCase(), city: data.city || "", terms: !!data.terms };
    const err = {};
    if (!f.first) err.first = "Prénom requis.";
    if (!f.last) err.last = "Nom requis.";
    if (!isEmail(f.email)) err.email = "Adresse email invalide.";
    else if (db.users.some((u) => u.email === f.email)) err.email = "Un compte existe déjà avec cet email.";
    if (!f.city) err.city = "Choisissez votre wilaya.";
    if ((data.password || "").length < 8) err.password = "8 caractères minimum.";
    else if (data.confirm !== data.password) err.confirm = "Les mots de passe ne correspondent pas.";
    if (!f.terms) err.terms = " Vous devez accepter les conditions.";
    a.form = f; a.fieldErrors = err; a.error = "";
    if (Object.keys(err).length === 0) {
      a.pendingPassword = data.password;
      a.code = newCode();
      a.step = "code";
    }
    return render();
  }
  if (form === "verify") {
    if ((data.code || "").trim() !== a.code) { a.error = "Code incorrect. Vérifiez les 6 chiffres."; return render(); }
    const f = a.form;
    const u = {
      id: Math.max(...db.users.map((x) => x.id)) + 1, role: "clipper", name: `${f.first} ${f.last}`, email: f.email, password: a.pendingPassword,
      city: f.city, status: "Actif", joined: TODAY, verified: true, level: "Nouveau", bio: "", handle: `@${f.first.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
      baseEarned: 0, baseBalance: 0, viewsFactor: 0, favorites: new Set(), joinedCampaigns: new Set(),
    };
    db.users.push(u);
    signups30[signups30.length - 1]++;
    notify(u.id, "🎉", "Bienvenue sur ClipBoost ! Rejoignez une première campagne pour commencer.");
    logActivity("👤", `${u.name} s'est inscrit (${u.email}).`);
    resetAuth();
    login(u, "Compte créé, bienvenue " + f.first + " 🎉");
  }
}

function resetAuth() {
  state.auth = { email: "", error: "", showPwd: false, step: "form", form: { first: "", last: "", email: "", city: "", terms: false }, fieldErrors: {}, code: "", pendingPassword: "" };
}

function login(u, message) {
  state.session = u.id;
  resetAuth();
  navigate(u.role === "admin" ? "#/admin/apercu" : "#/clipper/accueil");
  toast(message || `Connecté en tant que ${u.name}`);
}

function logout() {
  state.session = null;
  state.modal = null;
  navigate("#/connexion");
  toast("Vous êtes déconnecté.");
}
