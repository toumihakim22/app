// Espace Admin (7/13) : réglages du site.
// Les fichiers de web/src/admin/ sont collés dans l'ordre de leur numéro par web/build.mjs (même portée).

// ---------- Réglages ----------

// Aperçu en direct du formulaire de réglages : compteur et bandeau d'annonce (texte libre de l'admin, non traduit).
LIVE.admSettings = (d) => {
  const text = String(d.announcement || "").trim();
  return {
    count: `${fmt(String(d.announcement || "").length)}${NB}/${NB}140`,
    preview: text
      ? `<div class="flex items-center gap-2 rounded-control border border-brand-line bg-brand-soft px-3 py-2 text-small font-medium text-brand-fg">${icon("megaphone", "size-4 shrink-0")}<span class="min-w-0 truncate" dir="auto">${esc(text)}</span></div>`
      : `<p class="text-xs text-fg-subtle">${t("Aucun bandeau affiché.")}</p>`,
  };
};

const admSettingRow = (title, desc, control, id) =>
  `<div data-field class="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-8 sm:gap-y-2 [&>[data-field-error]]:basis-full sm:[&>[data-field-error]]:justify-end">
    <div class="min-w-0 sm:flex-1"><label for="${id}" class="text-sm font-medium text-fg">${title}</label><p id="${id}-desc" class="mt-0.5 text-small text-fg-muted">${desc}</p></div>
    <div class="shrink-0 sm:w-48">${control}</div></div>`;
const admSwitchRow = (s, key, title, desc) =>
  `<div class="flex items-center justify-between gap-6 py-4 first:pt-0 last:pb-0">
    <div class="min-w-0"><p class="text-sm font-medium text-fg">${title}</p><p class="mt-0.5 text-small text-fg-muted">${desc}</p></div>
    ${switchBtn(!!s[key], "adm-setting", key, title)}</div>`;
// Champs numériques des réglages : bornes vérifiées avant l'envoi (mêmes règles que le serveur). Libellé : texte source
// français, traduit à l'affichage (message d'erreur) ; 4e valeur : nombre décimal accepté.
const ADM_LIMITS = {
  minWithdraw: ["Retrait minimum", 0, Infinity], minBudget: ["Budget minimum d'une campagne", 0, Infinity], commissionRate: ["Commission {brand}", 0, 50],
  instantFeePercent: ["Frais du retrait instantané", 0, 20, true], instantMinFee: ["Frais minimum du retrait instantané", 0, Infinity],
  holdDays: ["Rétention des gains", 0, 60], earningDays: ["Fenêtre de gains", 1, 60], referralBonus: ["Prime de parrainage", 0, 1000000],
};
// Valeur affichée avec séparateur de milliers (« 50 000 ») ou virgule décimale (« 2,5 »). unit : "DA", "%" ou "jours"
// (accordé à la valeur enregistrée : « 1 jour », « 14 jours » ; « 14 يومًا » en arabe).
const admNumber = (s, key, unit) => {
  const decimal = ADM_LIMITS[key][3], v = Number(s[key]) || 0;
  const u = unit === "DA" ? t("DA") : unit === "jours" ? tPlural(v, "jour", "jours") : unit;
  return unitInput(`id="set-${key}" name="${key}" type="text" ${decimal ? 'inputmode="decimal" ' : ""}value="${decimal ? String(v).replace(".", ",") : fmt(v)}" autocomplete="off" aria-describedby="set-${key}-desc"`, u);
};

function aParametres() {
  const s = db.settings, live = LIVE.admSettings(s);
  const group = (title, desc, rows) => card(`${cardHeader(title, desc)}<div class="mt-4 divide-y divide-line">${rows}</div>`);
  return `${pageHeader(t("Réglages du site"), t("Ces réglages s'appliquent immédiatement à tout le site."))}
    <div class="mt-6 grid max-w-3xl gap-4 lg:gap-5">
      ${group(t("Accès"), t("Ces interrupteurs prennent effet dès le clic."),
        admSwitchRow(s, "signupsOpen", t("Inscriptions ouvertes"), t("Autoriser la création de nouveaux comptes Clipper et Agence."))
        + admSwitchRow(s, "maintenance", t("Mode maintenance"), t("Bloque la connexion des clippers et des agences et affiche un bandeau.")))}
      <form data-form="adm-settings" data-live="admSettings" novalidate class="grid gap-4 lg:gap-5">
        ${card(`${cardHeader(t("Annonce"), t("Bandeau affiché en haut du site et des espaces."))}
          <div class="mt-4 grid gap-1.5">
            <div class="flex items-baseline justify-between gap-3"><label for="set-announcement" class="text-small font-medium text-fg">${t("Texte de l'annonce")}</label><span data-live-out="count" dir="ltr" class="text-xs tabular-nums text-fg-subtle">${live.count}</span></div>
            <textarea id="set-announcement" name="announcement" rows="3" maxlength="140" dir="auto" placeholder="${esc(t("Ex. Nouvelle campagne Ramadan disponible"))}" aria-describedby="set-announcement-desc" class="${textareaCls}">${esc(s.announcement)}</textarea>
            <span id="set-announcement-desc" class="text-xs text-fg-subtle">${t("Laisser vide pour masquer le bandeau.")}</span>
          </div>
          <div class="mt-4 grid gap-1.5"><span class="text-small font-medium text-fg">${t("Aperçu")}</span><div data-live-out="preview">${live.preview}</div></div>`)}
        ${group(t("Argent"), t("Montants et commissions appliqués aux retraits et aux campagnes."),
          admSettingRow(t("Retrait minimum"), t("Montant minimum qu'un clipper peut retirer."), admNumber(s, "minWithdraw", "DA"), "set-minWithdraw")
          + admSettingRow(t("Budget minimum d'une campagne"), t("Budget exigé pour créer une campagne."), admNumber(s, "minBudget", "DA"), "set-minBudget")
          + admSettingRow(t("Commission {brand}"), t("Ajoutée au budget des nouvelles campagnes."), admNumber(s, "commissionRate", "%"), "set-commissionRate")
          + admSettingRow(t("Frais du retrait instantané"), t("Pourcentage prélevé sur un retrait instantané."), admNumber(s, "instantFeePercent", "%"), "set-instantFeePercent")
          + admSettingRow(t("Frais minimum du retrait instantané"), t("Montant prélevé au minimum sur un retrait instantané."), admNumber(s, "instantMinFee", "DA"), "set-instantMinFee")
          + admSettingRow(t("Prime de parrainage"), t("Versée au parrain quand son filleul fait son premier retrait. {brand} la paie ; 0 DA : pas de prime."), admNumber(s, "referralBonus", "DA"), "set-referralBonus"))}
        ${group(t("Délais"), t("Contrôle et rémunération des clips validés."),
          admSettingRow(t("Rétention des gains"), t("Délai de contrôle avant qu'un gain validé devienne retirable."), admNumber(s, "holdDays", "jours"), "set-holdDays")
          + admSettingRow(t("Fenêtre de gains"), t("Après la validation, chaque nouveau relevé paie les vues supplémentaires pendant ce délai."), admNumber(s, "earningDays", "jours"), "set-earningDays"))}
        ${card(`${cardHeader(t("Primes du classement hebdomadaire"), t("Versées chaque lundi aux 10 clippers qui ont le plus de vues validées la semaine écoulée. {brand} les paie : aucune campagne n'est débitée. 0 DA : pas de prime pour ce rang."))}
          <div class="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5">${(s.weeklyPrizes || []).map((v, i) => `<div data-field class="grid min-w-0 gap-1.5"><label for="set-prize-${i}" class="text-small font-medium text-fg">${lbOrdinal(i + 1)}</label>
            ${unitInput(`id="set-prize-${i}" name="prize-${i}" type="text" value="${fmt(v)}" autocomplete="off"`, t("DA"))}</div>`).join("")}</div>`)}
        <div data-sticky-save class="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 flex items-center justify-between gap-4 rounded-card border border-line bg-surface/95 px-4 py-3 shadow-popover backdrop-blur-md sm:px-5 lg:bottom-4">
          <p class="hidden text-small text-fg-muted sm:block">${t("Annonce, montants, délais et primes s'appliquent à tout le site dès l'enregistrement.")}</p>
          <button type="submit" class="${btn("primary", "md", "w-full sm:w-auto")}">${t("Enregistrer")}</button>
        </div>
      </form>
      ${window.__CLIPBOOST_OFFLINE__ ? `<section class="mt-4 flex flex-col gap-3 rounded-card border border-dashed border-line-strong p-5 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0"><h2 class="text-section text-fg">${t("Version de démonstration")}</h2><p class="mt-0.5 text-small text-fg-muted">${t("Les données sont enregistrées dans ce navigateur.")}</p></div>
        <button type="button" data-action="adm-reset-demo" class="${btn("dangerSoft", "sm")}">${t("Réinitialiser la démo")}</button></section>` : ""}
    </div>`;
}
