// Espace Agence (6/8) : formulaire de campagne (partagé avec l'espace Admin) et carte Visa / Mastercard.
// Les fichiers de web/src/agency/ sont collés dans l'ordre de leur numéro par web/build.mjs (même portée).

// ---------- Formulaire de campagne (partagé avec admin.js) ----------

const AG_EMOJIS = ["🎬", "⚽", "🍔", "📱", "👗", "🎵", "😂", "🚗", "💄", "🏝️", "🥤", "👕"];
// Choix de pictogramme (emoji) : même logique que SEG_CHOICE, en carré de 44 px.
const AG_EMOJI_CHOICE = "grid size-11 cursor-pointer place-items-center rounded-control border border-line-strong bg-surface text-xl transition-colors duration-150 hover:border-line-control peer-checked:border-brand peer-checked:bg-brand-soft peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus";
const AG_FIELDSET = "mt-6 border-t border-line pt-6 first:mt-0 first:border-0 first:pt-0";
// Légende flottante : rendue dans le flux (et non dans la bordure du fieldset).
const AG_LEGEND = "float-start mb-4 w-full text-section text-fg";
// Tuile de plateforme : vraie case à cocher (coin de la tuile), pictogramme et nom, visibles à toutes les tailles.
// Cochée : bordure et fond de la marque. Groupe en erreur (aucune plateforme) : toutes les tuiles bordées de rouge.
const AG_PF_TILE = "relative flex min-w-0 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-control border border-line-strong bg-surface px-2 pb-3 pt-5 text-fg-muted transition-colors duration-150 hover:border-line-control hover:text-fg has-checked:border-brand has-checked:bg-brand-soft has-checked:text-brand-fg has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus group-has-[[data-pf][aria-invalid=true]]/pf:border-danger-solid";
// Case d'une tuile : pas d'anneau propre, la tuile porte l'indicateur de focus (comme RADIO dans CHOICE).
const AG_PF_BOX = "absolute start-2.5 top-2.5 size-4 cursor-pointer rounded-[4px] accent-brand focus-visible:outline-none";
const agHint = (txt, error = false) => (error ? `<span class="inline-flex items-center gap-1 font-medium text-danger-fg">${icon("alert", "size-3.5 shrink-0")}${txt}</span>` : txt);

// Catégorie envoyée à l'API : celle de la liste, sinon (« Autre ») le texte précisé par l'agence ; une catégorie de la
// liste écrite autrement (« sport », « evenementiel ») reprend son nom exact.
const agFold = (s) => String(s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
function agCategoryOf(d) {
  if (d.category !== "Autre") return String(d.category || "");
  const other = String(d.categoryOther || "").trim().replace(/\s+/g, " ");
  return CATEGORIES.find((x) => x !== "Autre" && agFold(x) === agFold(other)) || other;
}

// Récapitulatif en direct de la campagne (équivalents en vues, budget débité, couverture : photo choisie, sinon
// pictogramme sur la teinte de la catégorie, avec la puce de tarif).
LIVE.campaign = (d) => {
  const admin = state.route.area === "admin", s = db.settings, commission = admin ? 0 : s.commissionRate;
  const r = agNum(d.rate), b = agNum(d.budget), mn = agNum(d.minPayout), mx = agNum(d.maxPayout);
  const views = (amount) => (r && amount ? `=${NB}${plural(Math.ceil((amount * 1000) / r), "vue", "vues")}` : "");
  const fee = Math.round((b * commission) / 100), cost = b + fee, credit = admin ? 0 : me().credit, waiting = admin ? 0 : agPendingCredit();
  const category = agCategoryOf(d), cat = CATEGORIES.includes(category) ? category : "Autre";
  const art = d.image
    ? `<img src="${esc(d.image)}" alt="" class="absolute inset-0 size-full object-cover"/>`
    : `<span class="text-4xl drop-shadow-[0_6px_14px_rgb(0_0_0/0.22)]">${esc(d.emoji || AG_EMOJIS[0])}</span>`;
  const waitingNote = waiting ? ` ${t("Recharge de {amount} en attente de confirmation.", { amount: da(waiting) })}` : "";
  return {
    cover: `<span class="cover absolute inset-0 grid place-items-center overflow-hidden" data-cat="${cat}">${art}${r ? agRateChip(r) : ""}</span>`,
    rate: r < 20 || r > 2000 ? agHint(t("Entre 20 et 2 000 DA pour 1 000 vues."), !!d.rate) : t("100 000 vues = {amount}", { amount: da(r * 100) }),
    min: views(mn) || t("Gain minimum d'un clip"),
    max: mx && mx <= mn ? agHint(t("Doit dépasser le seuil."), true) : b && mx > b ? agHint(t("Ne peut pas dépasser le budget."), true) : views(mx) || t("Gain maximum d'un clip"),
    budget: `${summary(admin
      ? [[t("Budget"), money(b)], [t("Commission {brand}"), t("Aucune")], [t("Engagé à la publication"), money(b), true]]
      : [[t("Budget"), money(b)], [t("Commission {brand} ({rate} %)", { rate: commission }), money(fee)], [t("Débité à l'approbation"), money(cost), true]])}
      ${b && b < s.minBudget ? `<div class="mt-3">${alertBox("warning", t("Le budget minimum est de {amount}.", { amount: da(s.minBudget) }))}</div>`
        : !admin && cost > credit ? `<div class="mt-3">${alertBox("warning", `${t("Crédit actuel : {credit}. Il manque {missing} pour l'approbation.", { credit: da(credit), missing: `<strong class="font-semibold tabular-nums">${da(cost - credit)}</strong>` })}${waitingNote} <button type="button" data-action="ag-credit" class="${btn("link")}">${t("Recharger le crédit")}</button>`)}</div>`
        : !admin ? `<p class="mt-3 text-xs tabular-nums text-fg-subtle">${t("Crédit actuel : {credit}. Il restera {left} après l'approbation.", { credit: da(credit), left: da(credit - cost) })}</p>` : ""}`,
  };
};

// campaignForm(formName, submitLabel, note, c = null) : contenu du formulaire de campagne, en 4 fieldsets.
// À placer dans modalShell({ title, description, size: "xl", form: formName, live: "campaign", body: campaignForm(…), footer }).
// c : campagne modifiée ou relancée (champs préremplis ; une catégorie hors liste s'affiche « Autre » + son texte).
// Valeurs : brouillon de la modale (state.modal.draft, gardé par main.js à chaque réaffichage), sinon c, sinon des
// valeurs proposées (règles suggérées dans la langue de l'agence). Le <form data-form> d'ouverture n'est volontairement
// pas refermé : dans une modale qui est déjà le formulaire, le navigateur ignore cette balise imbriquée ; dans un
// conteneur qui n'est pas un formulaire, elle crée le formulaire, refermé avec son parent. La rangée d'envoi interne
// disparaît quand la modale-formulaire a son propre pied. submitLabel et note : textes déjà traduits par l'appelant.
function campaignForm(formName, submitLabel, note, c = null) {
  const s = db.settings, admin = formName === "adm-campaign";
  const known = !!c && CATEGORIES.includes(c.category) && c.category !== "Autre";
  const base = c
    ? { title: c.title, brand: c.brand || "", category: known ? c.category : "Autre", categoryOther: known ? "" : c.category, emoji: c.emoji, image: c.image || "",
      rate: fmt(c.rate), budget: fmt(c.budget), minPayout: fmt(c.minPayout), maxPayout: fmt(c.maxPayout), rules: (c.rules || []).join("\n"),
      ...Object.fromEntries(PLATFORMS.map((pl) => [`pf-${pl}`, (c.platforms || []).includes(pl)])) }
    : { title: "", brand: "", category: CATEGORIES[0], categoryOther: "", emoji: AG_EMOJIS[0], image: "",
      rate: fmt(120), budget: fmt(Math.max(200000, s.minBudget)), minPayout: fmt(240), maxPayout: fmt(24000), rules: `${t("Clip de 15 à 60 secondes")}\n${t("Mentionner la marque")}`,
      ...Object.fromEntries(PLATFORMS.map((pl) => [`pf-${pl}`, true])) };
  const v = { ...base, ...((state.modal && state.modal.draft) || {}) };
  const live = LIVE.campaign(v);
  const out = (k) => `<span data-live-out="${k}">${live[k]}</span>`;
  const emoji = v.emoji || AG_EMOJIS[0], emojis = AG_EMOJIS.includes(emoji) ? AG_EMOJIS : [emoji, ...AG_EMOJIS];
  const on = PLATFORMS.filter((pl) => !!v[`pf-${pl}`]), all = on.length === PLATFORMS.length;
  // Sans photo, l'aperçu de l'imageField est la couverture en direct (LIVE.campaign → data-live-out="cover").
  const coverFallback = `<span data-live-out="cover" class="absolute inset-0">${live.cover}</span>`;
  return `<form data-form="${formName}" data-live="campaign" novalidate class="contents">
    <fieldset class="${AG_FIELDSET}">
      <legend class="${AG_LEGEND}">${t("Campagne")}</legend>
      <div class="clear-both grid gap-5 sm:grid-cols-[minmax(0,1fr)_15rem]">
        <div class="grid content-start gap-4">
          ${field(t("Titre de la campagne"), `<input name="title" required maxlength="40" value="${esc(v.title)}" placeholder="${t("Ex. Spécial Ramadan")}" autocomplete="off" autofocus class="${inputCls}"/>`)}
          ${admin ? field(t("Marque"), `<input name="brand" required maxlength="30" value="${esc(v.brand || "")}" autocomplete="off" class="${inputCls}"/>`) : ""}
          <div class="group/cat grid gap-4">
            ${field(t("Catégorie"), `<span class="relative block"><select name="category" class="${selectCls}">${CATEGORIES.map((x) => `<option value="${esc(x)}"${x === "Autre" ? " data-other" : ""}${x === v.category ? " selected" : ""}>${esc(x === "Autre" ? t("Autre (à préciser)") : t(x))}</option>`).join("")}</select>${CHEVRON}</span>`, t("La catégorie donne sa teinte à la couverture."))}
            <div class="hidden group-has-[[data-other]:checked]/cat:block">${field(t("Précisez la catégorie"), `<input name="categoryOther" maxlength="30" value="${esc(v.categoryOther || "")}" placeholder="${t("Ex. Artisanat, Restauration, Sport automobile")}" autocomplete="off" class="${inputCls}"/>`, t("2 à 30 caractères. Affichée telle quelle aux clippers."))}</div>
          </div>
        </div>
        ${imageField({ name: "image", value: v.image || "", shape: "campaign", label: t("Photo de la campagne"), hint: t("Facultatif. Remplace la couverture en dégradé."), fallback: coverFallback })}
      </div>
      <div class="mt-5 grid gap-1.5" role="radiogroup" aria-labelledby="${formName}-emoji">
        <span id="${formName}-emoji" class="text-small font-medium text-fg">${t("Pictogramme")}</span>
        <div class="flex flex-wrap gap-2">${emojis.map((e) => `<label class="cursor-pointer"><input type="radio" name="emoji" value="${esc(e)}" ${e === emoji ? "checked" : ""} class="peer sr-only"/><span class="${AG_EMOJI_CHOICE}">${e}</span></label>`).join("")}</div>
        <span class="text-xs text-fg-subtle">${t("Affiché sur la couverture en dégradé, quand la campagne n'a pas de photo.")}</span>
      </div>
    </fieldset>
    <fieldset class="${AG_FIELDSET}">
      <legend class="${AG_LEGEND}">${t("Rémunération des clippers")}</legend>
      <div class="clear-both grid gap-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
        ${field(t("Tarif"), unitInput(`name="rate" value="${esc(v.rate)}" required autocomplete="off"`, t("DA / 1 000 vues")), out("rate"))}
        ${field(t("Seuil par clip"), unitInput(`name="minPayout" value="${esc(v.minPayout)}" required autocomplete="off"`, t("DA")), out("min"))}
        ${field(t("Plafond par clip"), unitInput(`name="maxPayout" value="${esc(v.maxPayout)}" required autocomplete="off"`, t("DA")), out("max"))}
      </div>
      <p class="mt-3 text-xs text-fg-subtle">${t("Seuil : gain à atteindre avant que le clip soit examiné. Plafond : un clip viral ne peut pas dépasser ce montant.")}</p>
    </fieldset>
    <fieldset class="${AG_FIELDSET}">
      <legend class="${AG_LEGEND}">${t("Budget")}</legend>
      <div class="clear-both grid gap-4 sm:grid-cols-2">
        ${field(t("Budget de la campagne"), unitInput(`name="budget" value="${esc(v.budget)}" required autocomplete="off"`, t("DA")), t("Minimum {amount}.", { amount: da(s.minBudget) }))}
      </div>
      <div data-live-out="budget">${live.budget}</div>
      ${note ? `<p class="mt-3 text-xs text-fg-subtle">${note}</p>` : ""}
    </fieldset>
    <fieldset class="${AG_FIELDSET}">
      <legend class="${AG_LEGEND}">${t("Diffusion")}</legend>
      <div class="clear-both grid gap-5">
        <div class="group/pf grid gap-2" role="group" aria-labelledby="${formName}-pf" data-field data-pf-group>
          <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
            <span id="${formName}-pf" class="text-small font-medium text-fg">${t("Plateformes")}</span>
            <label class="inline-flex cursor-pointer items-center gap-2 text-small font-medium text-fg-muted transition-colors duration-150 hover:text-fg"><input type="checkbox" data-pf-all ${all ? "checked" : on.length ? "data-indeterminate" : ""} class="${CHECKBOX}"/>${t("Toutes les plateformes")}</label>
          </div>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">${PLATFORMS.map((pl) => `<label class="${AG_PF_TILE}"><input type="checkbox" name="pf-${pl}" data-pf ${v[`pf-${pl}`] ? "checked" : ""} class="${AG_PF_BOX}"/>${icon(PLATFORM_ICON[pl] || "film", "size-6 shrink-0")}<span class="max-w-full truncate text-sm font-medium">${pl}</span></label>`).join("")}</div>
          <span class="text-xs text-fg-subtle">${t("Les clippers publient leur clip sur l'une de ces plateformes, ou sur toutes.")}</span>
        </div>
        ${field(t("Règles"), `<textarea name="rules" rows="3" class="${textareaCls}">${esc(v.rules || "")}</textarea>`, t("Une règle par ligne, affichée aux clippers."))}
      </div>
    </fieldset>
    <div class="mt-6 flex justify-end [form[role=dialog]:has(>footer)_&]:hidden"><button type="submit" class="${btn("primary", "md", "w-full sm:w-auto")}">${submitLabel}</button></div>`;
}

// Case « Toutes les plateformes » : elle coche ou décoche les quatre, et suit leur état (cochée, en partie, vide) sans
// réafficher le formulaire. main.js applique data-indeterminate après chaque rendu ; cet écouteur (document) passe
// avant celui des brouillons (window) : le brouillon enregistre l'état final des cases. Une case cochée efface aussi
// l'erreur « Choisissez au moins une plateforme ».
document.addEventListener("change", (e) => {
  const el = e.target, group = el && el.closest ? el.closest("[data-pf-group]") : null;
  if (!group || el.type !== "checkbox") return;
  const master = group.querySelector("[data-pf-all]"), boxes = [...group.querySelectorAll("[data-pf]")];
  if (el === master) boxes.forEach((b) => { b.checked = master.checked; });
  const n = boxes.filter((b) => b.checked).length;
  if (master) { master.checked = n === boxes.length; master.indeterminate = n > 0 && n < boxes.length; }
  if (n) {
    group.querySelectorAll('[aria-invalid="true"]').forEach((b) => b.removeAttribute("aria-invalid"));
    group.querySelectorAll("[data-field-error]").forEach((x) => x.remove());
  }
});

// Données du formulaire de campagne au format attendu par l'API.
// image : data URL (nouvelle photo), adresse actuelle (inchangée) ou "" (aucune / retirée), voir imageField (ui.js).
function campaignPayload(data) {
  const num = (v) => +String(v ?? "").replace(/\s/g, ""); // « 200 000 » saisi avec des espaces
  return {
    title: String(data.title || "").trim(), brand: data.brand, category: agCategoryOf(data),
    rate: num(data.rate), budget: num(data.budget), minPayout: num(data.minPayout), maxPayout: num(data.maxPayout),
    emoji: data.emoji, platforms: PLATFORMS.filter((pl) => data[`pf-${pl}`]),
    rules: String(data.rules || "").split("\n").map((r) => r.trim()).filter(Boolean),
    image: data.image || "",
  };
}

// ---------- Paiement par carte Visa / Mastercard ----------
// Le numéro complet ne quitte jamais le navigateur : seuls la marque et les 4 derniers chiffres sont envoyés.
const AG_CARD = "carte Visa / Mastercard";
const agDigits = (v) => String(v || "").replace(/\D/g, "");
// Marque d'après les premiers chiffres : Visa 4… ; Mastercard 51–55 ou 2221–2720.
function agCardBrand(d) {
  if (/^4/.test(d)) return "Visa";
  if (/^5[1-5]/.test(d)) return "Mastercard";
  const p = +d.slice(0, 4);
  return d.length >= 4 && p >= 2221 && p <= 2720 ? "Mastercard" : "";
}
// Clé de Luhn (chiffre de contrôle des numéros de carte).
function agLuhn(d) {
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = +d[d.length - 1 - i];
    if (i % 2) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
}
// Contrôles de la carte ; renvoie [champ, message] ou null.
function agCardError(d) {
  const digits = agDigits(d.cardNumber), brand = agCardBrand(digits);
  if (String(d.cardName || "").trim().length < 2) return ["cardName", t("Indiquez le nom du titulaire, tel qu'il est inscrit sur la carte.")];
  if (!digits) return ["cardNumber", t("Indiquez le numéro de la carte.")];
  if (!brand) return ["cardNumber", t("Seules les cartes Visa et Mastercard sont acceptées.")];
  const lengths = brand === "Visa" ? [13, 16, 19] : [16];
  if (!lengths.includes(digits.length) || !agLuhn(digits)) return ["cardNumber", t("Numéro de carte invalide : vérifiez-le.")];
  const exp = /^(\d{2})\/(\d{2})$/.exec(String(d.cardExp || "").trim()), month = exp ? +exp[1] : 0;
  if (!exp || month < 1 || month > 12) return ["cardExp", t("Date d'expiration invalide (MM/AA).")];
  const now = new Date(), year = 2000 + +exp[2];
  if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) return ["cardExp", t("Cette carte a expiré.")];
  if (!/^\d{3}$/.test(String(d.cardCvc || "").trim())) return ["cardCvc", t("Le code de sécurité compte 3 chiffres (au dos de la carte).")];
  return null;
}
const agBrandMark = (b) => `<span class="inline-flex h-5 items-center rounded-[4px] border border-line-strong bg-surface px-1.5 text-[10px] font-bold uppercase tracking-wider text-fg">${b}</span>`;
// Mise en forme pendant la saisie (numéro par groupes de 4, MM/AA, 3 chiffres), curseur gardé après le même chiffre.
function agFormatField(el, format) {
  const v = el.value, next = format(v);
  if (next === v) return;
  const pos = el.selectionStart ?? v.length, atEnd = pos >= v.length, before = agDigits(v.slice(0, pos)).length;
  el.value = next;
  let i = 0;
  if (atEnd) i = next.length;
  else for (let seen = 0; i < next.length && seen < before; i++) if (/\d/.test(next[i])) seen++;
  try { el.setSelectionRange(i, i); } catch (err) {}
}
document.addEventListener("input", (e) => {
  const el = e.target;
  if (!el || !el.matches) return;
  if (el.matches("[data-card-number]")) agFormatField(el, (v) => agDigits(v).slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 "));
  else if (el.matches("[data-card-exp]")) agFormatField(el, (v) => { let d = agDigits(v); if (/^[2-9]/.test(d)) d = `0${d}`; d = d.slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; });
  else if (el.matches("[data-card-cvc]")) agFormatField(el, (v) => agDigits(v).slice(0, 3));
});
