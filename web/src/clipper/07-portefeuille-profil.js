// Espace Clipper (7/9) : portefeuille, profil, paramètres, table des vues (CLIPPER_VIEWS) et récapitulatifs en direct.
// Les fichiers de web/src/clipper/ sont collés dans l'ordre de leur numéro par web/build.mjs (même portée).

function cPortefeuille() {
  const u = me(), all = myTx();
  const list = all.filter((x) => state.tx.type === "tous" || x.type === state.tx.type);
  // Historique regroupé par mois (la liste arrive triée du plus récent au plus ancien).
  const groups = [];
  for (const x of list) {
    const key = x.date.slice(0, 7), last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(x); else groups.push({ key, items: [x] });
  }
  // Valeurs des segments : « Tous », « Gains », « Retraits » (lues par l'action tx-type) ; libellés traduits.
  const typeSeg = segmented("tx-type", { tous: "Tous", gain: "Gains", retrait: "Retraits" }[state.tx.type], [["Tous", t("Tous")], ["Gains", t("Gains")], ["Retraits", t("Retraits")]], t("Type d'opération"));
  const method = u.payoutMethod;
  const payoutCard = card(`${cardHeader(t("Moyen de retrait"))}
    <div class="mt-4 flex items-center gap-3">
      <span class="grid size-10 shrink-0 place-items-center rounded-tile bg-subtle text-fg-muted">${icon(method ? CL_PAYOUT_ICON[method] || "bank" : "wallet", "size-5")}</span>
      <div class="min-w-0 flex-1">${method
        ? `<p class="truncate text-sm font-medium text-fg">${esc(t(method))}</p><p class="truncate font-mono text-small text-fg-subtle" dir="ltr">${maskAccount(u.payoutAccount)}</p>`
        : `<p class="text-sm font-medium text-fg">${t("Aucun moyen de retrait")}</p><p class="text-small text-fg-subtle">${t("Ajoutez un compte pour être payé.")}</p>`}</div>
      <a href="#/clipper/parametres" class="${btn("link", "", "shrink-0 text-small")}">${method ? t("Modifier") : t("Ajouter")}</a>
    </div>`, "p-5");
  const history = card(`${cardHeader(t("Historique"), "", typeSeg)}
    ${list.length ? `<div class="mt-4 grid gap-5">${groups.map((g) => {
      const month = clMonthLabel(g.key);
      return `<section aria-label="${esc(month)}"><h3 class="font-sans text-micro font-medium uppercase tracking-[0.08em] text-fg-subtle rtl:tracking-normal">${esc(month)}</h3>
        <ul class="mt-1 divide-y divide-line">${g.items.map(txRow).join("")}</ul></section>`;
    }).join("")}</div>`
      : emptyState("wallet", all.length ? t("Aucune opération de ce type") : t("Aucune opération pour le moment"), t("Vos gains validés et vos retraits apparaîtront ici."), "", { inCard: true })}`, "p-5");
  return `${pageHeader(t("Portefeuille"), t("Vos gains, versements et retraits."))}
    <div class="mt-6 grid items-start gap-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-5">
      <div class="grid content-start gap-4 lg:gap-5">${clWalletCard()}${payoutCard}</div>
      ${history}
    </div>`;
}

// Comptes sociaux du Profil : un compte par plateforme, prouvé par le code « CB-XXXX » collé dans sa bio. En attente :
// le code (copié d'un clic), le mode d'emploi et « Vérifier » ; vérifié : sa date. Retirer un compte vérifié demande
// confirmation (modale cl-social-remove). Ajout : une plateforme encore libre et l'identifiant (ou le lien du profil).
function clSocialCard() {
  const list = clSocial(), free = PLATFORMS.filter((p) => !list.some((a) => a.platform === p));
  const low = (s) => s.charAt(0).toLowerCase() + s.slice(1);
  const row = (a) => {
    const ok = a.status === "verified";
    const meta = ok ? t("Vérifié le {date}", { date: date(a.verifiedAt) }) : a.checkedAt ? t("Dernier essai : {when}", { when: low(ago(a.checkedAt)) }) : t("En attente de vérification");
    const remove = t("Retirer le compte {platform}", { platform: a.platform });
    return `<li class="rounded-tile border border-line p-3">
      <div class="flex items-center gap-3">
        <span class="grid size-10 shrink-0 place-items-center rounded-tile bg-muted text-fg">${icon(PLATFORM_ICON[a.platform] || "film", "size-[18px]")}</span>
        <div class="min-w-0 flex-1">
          <p class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"><span class="min-w-0 truncate text-sm font-medium text-fg" dir="ltr">@${esc(a.handle)}</span>${ok ? badge(t("Vérifié"), "success", { ic: "check" }) : badge(t("En attente"), "warning", { dot: true })}</p>
          <p class="mt-0.5 text-xs text-fg-subtle">${esc(a.platform)} · ${meta}</p>
        </div>
        <button type="button" data-action="cl-social-remove" data-id="${a.id}" class="${iconBtn("sm")}" aria-label="${esc(remove)}" title="${esc(remove)}">${icon("trash")}</button>
      </div>
      ${ok ? "" : `<div class="mt-3 flex flex-col gap-3 rounded-tile bg-subtle p-3 sm:flex-row sm:items-center">
        <button type="button" data-action="cl-social-copy" data-value="${esc(a.code)}" class="inline-flex h-9 shrink-0 items-center gap-2 self-start rounded-full border border-line-strong bg-surface px-3.5 font-mono text-sm font-semibold tracking-wider text-fg shadow-control transition-colors duration-150 hover:border-line-control sm:self-auto ${FOCUS}" aria-label="${esc(t("Copier le code {code}", { code: a.code }))}" title="${esc(t("Copier le code"))}"><span dir="ltr">${esc(a.code)}</span>${icon("copy", "size-4 text-fg-subtle")}</button>
        <p class="min-w-0 flex-1 text-xs leading-5 text-fg-muted">${t("Collez ce code dans la bio de votre compte, puis cliquez sur Vérifier. Vous pourrez le retirer ensuite.")}</p>
        <button type="button" data-action="cl-social-verify" data-id="${a.id}" class="${btn("primary", "sm", "self-start sm:self-auto")}">${icon("shield")}${t("Vérifier")}</button>
      </div>`}
    </li>`;
  };
  const add = free.length
    ? `<form data-form="social" novalidate class="mt-5 border-t border-line pt-5">
        <h3 class="text-sm font-semibold text-fg">${t("Ajouter un compte")}</h3>
        <div class="mt-3 grid items-start gap-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto]">
          ${field(t("Plateforme"), `<span class="relative block"><select name="platform" class="${selectCls}">${free.map((p) => `<option value="${p}">${p}</option>`).join("")}</select>${CHEVRON}</span>`)}
          ${field(t("Identifiant"), `<span class="relative block" dir="ltr"><span class="pointer-events-none absolute inset-y-0 start-3 flex items-center text-sm text-fg-subtle" aria-hidden="true">@</span><input name="handle" maxlength="200" placeholder="${esc(t("votrecompte"))}" autocomplete="off" autocapitalize="off" spellcheck="false" class="${inputCls} ps-8"/></span>`, t("Votre nom d'utilisateur, ou le lien de votre profil."))}
          <button class="${btn("secondary", "md", "sm:mt-[26px]")}">${icon("plus")}${t("Ajouter")}</button>
        </div>
      </form>`
    : `<p class="mt-5 border-t border-line pt-5 text-small text-fg-subtle">${t("Un compte par plateforme : retirez-en un pour le remplacer.")}</p>`;
  return `<div data-row="comptes" class="rounded-card">${card(`${cardHeader(t("Comptes sociaux"), t("Seuls les clips publiés depuis un compte vérifié sont acceptés."))}
    ${list.length ? `<ul class="mt-4 grid gap-3">${list.map(row).join("")}</ul>`
      : emptyState("shield", t("Aucun compte ajouté"), t("Ajoutez le compte depuis lequel vous publiez vos clips, puis vérifiez-le avec son code."), "", { inCard: true })}
    ${add}`)}</div>`;
}

// Profil : photo de profil, informations publiques et comptes sociaux (vérifiés par un code dans leur bio). Le compte
// (email, mot de passe), la langue et le thème sont dans Paramètres.
function cProfil() {
  const u = me();
  // Sans photo : les initiales sur la teinte de l'avatar, à la taille du cadre de l'aperçu.
  const initialsFallback = avatar({ ...u, avatar: null }, "size-full text-2xl");
  const form = card(`<form data-form="profile">
      <h2 class="text-section text-fg">${t("Informations publiques")}</h2><p class="mt-0.5 text-small text-fg-muted">${t("Visibles par les marques qui consultent vos clips.")}</p>
      <div class="mt-5">${imageField({ name: "avatar", value: u.avatar || "", shape: "avatar", label: t("Photo de profil"), hint: t("JPEG, PNG ou WebP. Elle est recadrée en carré et s'affiche en rond."), fallback: initialsFallback })}</div>
      <div class="mt-5 grid gap-4 sm:grid-cols-2">
        ${field(t("Nom complet"), `<input name="name" required maxlength="80" value="${esc(u.name)}" autocomplete="name" class="${inputCls}"/>`)}
        ${field(t("Pays"), countrySelect("country", u.country))}
        <div class="sm:col-span-2">${field(`${t("Bio")} ${clOptional()}`, `<textarea name="bio" rows="3" maxlength="300" placeholder="${t("Présentez votre style de clips aux marques…")}" class="${textareaCls}">${esc(u.bio || "")}</textarea>`, t("300 caractères maximum."))}</div>
      </div>
      <div class="mt-6 flex justify-end"><button class="${btn("primary")}">${t("Enregistrer")}</button></div>
    </form>`);
  const identity = card(`<div class="flex flex-col items-center text-center">${avatar(u, "xl")}
      <p class="mt-4 break-words font-display text-section text-fg">${esc(u.name)}</p>
      <p class="mt-0.5 flex flex-wrap items-center justify-center gap-1.5 text-small text-fg-muted">${u.handle ? `<span dir="ltr">${esc(u.handle)}</span> · ` : ""}${esc(t(u.country))}${u.country === "Algérie" ? flagDz() : ""}</p>
      ${u.level ? `<div class="mt-3">${badge(esc(t(u.level)), "brand", { ic: "medal" })}</div>` : ""}
      ${u.bio ? `<p class="mt-4 text-sm text-fg-muted">${esc(u.bio)}</p>` : ""}
      <p class="mt-4 text-xs text-fg-subtle">${t("Membre depuis le {date}", { date: date(u.joined) })}</p>
      <div class="mt-4 border-t border-line pt-4 self-stretch">${clLink("#/clipper/parametres", t("Compte, langue et thème"))}</div></div>`);
  return `${pageHeader(t("Profil"), t("Vos informations publiques, votre photo et vos comptes sociaux."))}
    <div class="mt-6 grid items-start gap-4 lg:gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div class="grid min-w-0 content-start gap-4 lg:gap-5">${form}${clSocialCard()}</div>
      ${identity}
    </div>`;
}

// Paramètres : préférences (langue, thème), moyen de retrait, règles de paiement, compte et connexion.
function cParametres() {
  const u = me(), s = db.settings, current = u.payoutMethod || PAYOUT_METHODS[0];
  const rules = [
    [t("Seuil de paiement"), t("Un clip doit atteindre le seuil minimum de sa campagne pour être examiné."), t("Selon la campagne")],
    [t("Fenêtre de gains"), t("Un clip validé continue de rapporter pendant cette durée, jusqu'au plafond par clip."), plural(s.earningDays, "jour", "jours")],
    [t("Rétention"), t("Contrôle anti-fraude : chaque gain devient retirable ensuite."), plural(s.holdDays, "jour", "jours")],
    [t("Retrait minimum"), "", money(s.minWithdraw)],
    [t("Retrait standard"), "", t("Gratuit")],
    [t("Retrait instantané"), t("Traité en priorité."), t("{pct}, min. {amount}", { pct: pct(s.instantFeePercent), amount: money(s.instantMinFee) })],
  ];
  const pref = (title, text, control) => `<div class="grid gap-3 py-4 first:pt-0 last:pb-0">
      <div class="min-w-0"><p class="text-sm font-medium text-fg">${title}</p><p class="mt-0.5 text-xs text-fg-subtle">${text}</p></div>${control}</div>`;
  const prefs = card(`${cardHeader(t("Préférences"), t("La langue et l'apparence de votre espace."))}
      <div class="mt-4 divide-y divide-line">
        ${pref(t("Langue"), t("Enregistrée sur votre compte : elle vous suit sur tous vos appareils."), langSwitch({ full: true, cls: "w-full sm:w-auto" }))}
        ${pref(t("Thème"), t("Clair, sombre, ou selon le réglage de votre appareil."), themeModeSwitch({ labels: true, cls: "w-full sm:w-auto" }))}
      </div>`);
  // Type de compte : valeur envoyée en français (PAYOUT_METHODS) ; « RIB » seul sur téléphone, « RIB bancaire » ensuite.
  const methodLabel = (m) => (m === "RIB bancaire"
    ? `<span class="sm:hidden">${t("RIB")}</span><span class="hidden sm:inline">${t("RIB bancaire")}</span>`
    : esc(t(m)));
  const payout = card(`${cardHeader(t("Moyen de retrait"), t("Vos gains sont versés sur ce compte, après validation de chaque demande par l'équipe {brand}."))}
        <form data-form="payout" class="mt-5 grid gap-5">
          <fieldset><legend class="mb-1.5 text-small font-medium text-fg">${t("Type de compte")}</legend>
            <div class="grid grid-cols-3 gap-2">${PAYOUT_METHODS.map((m) => `<label class="block min-w-0"><input type="radio" name="payoutMethod" value="${m}" ${current === m ? "checked" : ""} class="peer sr-only"/><span class="${SEG_CHOICE}"><span class="hidden sm:contents">${icon(CL_PAYOUT_ICON[m] || "bank")}</span><span class="truncate">${methodLabel(m)}</span></span></label>`).join("")}</div></fieldset>
          ${field(t("Numéro de compte"), `<input name="payoutAccount" required maxlength="60" value="${esc(u.payoutAccount || "")}" placeholder="${t("RIP, numéro CCP ou RIB")}" autocomplete="off" spellcheck="false" dir="ltr" class="${inputCls} font-mono"/>`, t("Vérifiez ce numéro : les virements sont envoyés tels quels."))}
          <div class="flex justify-end"><button class="${btn("primary")}">${t("Enregistrer")}</button></div>
        </form>`);
  const howPaid = card(`${cardHeader(t("Comment vous êtes payé"), t("Les règles appliquées à chaque clip et à chaque retrait."))}
        <dl class="mt-3 divide-y divide-line">${rules.map(([label, d, v]) => `<div class="flex items-start justify-between gap-4 py-3.5 last:pb-0">
          <dt class="min-w-0"><span class="block text-sm text-fg-muted">${label}</span>${d ? `<span class="mt-0.5 block text-xs text-fg-subtle">${d}</span>` : ""}</dt>
          <dd class="shrink-0 text-end text-sm font-medium tabular-nums text-fg">${v}</dd></div>`).join("")}</dl>`);
  return `${pageHeader(t("Paramètres"), t("Langue, thème, moyen de retrait et sécurité de votre compte."))}
    <div class="mt-6 grid items-start gap-4 lg:gap-5 xl:grid-cols-2">
      <div class="grid content-start gap-4 lg:gap-5">${prefs}${payout}</div>
      <div class="grid content-start gap-4 lg:gap-5">${accountCard(u)}${howPaid}</div>
    </div>`;
}

// agence : page hors navigation (ITEM_PAGES dans main.js), « Agences » y reste l'entrée courante.
const CLIPPER_VIEWS = { accueil: cAccueil, decouvrir: cDecouvrir, agences: cAgences, agence: cAgence, publications: cPublications, messages: cMessages, classement: cClassement, academie: cAcademie, parrainage: cParrainage, portefeuille: cPortefeuille, profil: cProfil, parametres: cParametres };

// ---------- Récapitulatifs en direct (main.js appelle LIVE[nom] à chaque saisie) ----------
LIVE.withdraw = (d) => {
  const a = Math.max(0, Math.round(+String(d.amount || "").replace(/\D/g, "")) || 0), s = db.settings;
  const fee = d.speed === "instant" ? Math.max(s.instantMinFee, Math.round((a * s.instantFeePercent) / 100)) : 0;
  return {
    "": summary([[t("Montant demandé"), money(a)], [t("Frais"), fee ? money(fee) : t("Aucun")], [t("Vous recevrez"), money(Math.max(0, a - fee)), true]]),
    btn: a ? t("Confirmer le retrait de {amount}", { amount: da(a) }) : t("Confirmer le retrait"),
  };
};
// Soumission d'un clip : coche verte dans chaque champ de lien dès que le lien pointe vers sa plateforme (https).
// Un lien qui nomme un autre compte que le compte vérifié de la plateforme n'a pas de coche.
LIVE.clip = (d) => { const v = clVerifiedMap(); return Object.fromEntries(PLATFORMS.map((p) => [`ok-${p}`, clUrlGood(p, d[`url-${p}`], v.get(p)) ? icon("checkCircle", "size-4") : ""])); };
// Contestation d'un refus : compteur de caractères du message.
LIVE.clAppeal = (d) => ({ count: `${fmt(String(d.message || "").trim().length)}${NB}/${NB}${fmt(1000)}` });
