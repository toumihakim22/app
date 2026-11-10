// Espace Admin (9/13) : mon compte.
// Les fichiers de web/src/admin/ sont collés dans l'ordre de leur numéro par web/build.mjs (même portée).

// ---------- Mon compte (#/admin/compte) ----------
// Photo et nom de l'administrateur (PATCH /api/me), langue et thème de l'interface, mot de passe (accountCard, ui.js).
function aCompte() {
  const u = me();
  // Sans photo : les initiales sur la teinte de l'avatar, à la taille du cadre de l'aperçu.
  const fallback = avatar({ ...u, avatar: null }, "size-full text-2xl");
  const pref = (title, text, control) => `<div class="grid gap-3 py-4 first:pt-0 last:pb-0">
      <div class="min-w-0"><p class="text-sm font-medium text-fg">${title}</p><p class="mt-0.5 text-xs text-fg-subtle">${text}</p></div>${control}</div>`;
  const profile = card(`<form data-form="adm-account" novalidate>
      ${cardHeader(t("Profil"), t("Votre photo et votre nom s'affichent dans la barre du haut et dans le journal d'activité."))}
      <div class="mt-5">${imageField({ name: "avatar", value: u.avatar || "", shape: "avatar", label: t("Photo de profil"), hint: t("JPEG, PNG ou WebP. Elle est recadrée en carré et s'affiche en rond."), fallback })}</div>
      <div class="mt-5">${field(t("Nom"), `<input name="name" required maxlength="80" value="${esc(u.name)}" autocomplete="name" dir="auto" class="${inputCls}"/>`)}</div>
      <div class="mt-6 flex justify-end"><button type="submit" class="${btn("primary", "md", "w-full sm:w-auto")}">${t("Enregistrer")}</button></div>
    </form>`);
  const prefs = card(`${cardHeader(t("Préférences"), t("La langue et l'apparence de votre espace."))}
      <div class="mt-4 divide-y divide-line">
        ${pref(t("Langue"), t("Enregistrée sur votre compte : elle vous suit sur tous vos appareils."), langSwitch({ full: true, cls: "w-full sm:w-auto" }))}
        ${pref(t("Thème"), t("Clair, sombre, ou selon le réglage de votre appareil."), themeModeSwitch({ labels: true, cls: "w-full sm:w-auto" }))}
      </div>`);
  return `${pageHeader(t("Mon compte"), t("Votre photo, votre nom, la langue et le thème de l'administration, et la sécurité du compte."),
      `<a href="#/admin/parametres" class="${btn("secondary")}">${icon("gear")}${t("Réglages du site")}</a>`)}
    <div class="mt-6 grid items-start gap-4 lg:gap-5 xl:grid-cols-2">
      <div class="grid content-start gap-4 lg:gap-5">${profile}${prefs}</div>
      <div class="grid content-start gap-4 lg:gap-5">${accountCard(u)}</div>
    </div>`;
}

// utilisateur : page hors navigation (ITEM_PAGES dans main.js) ; compte : « Mon compte », ouverte par le menu du compte.
// Messages : questions des clippers sur les campagnes de ClipBoost, auxquelles l'équipe répond (#/admin/messages/<campagne>~<clipper>).
const aMessages = () => msgTeamPage({
  area: "admin", form: "adm-msg", campaignAction: "adm-camp", filter: state.adm.msgFilter || "all", filterAction: "adm-msg-filter",
  title: t("Messages"), text: t("Les questions des clippers sur les campagnes de {brand}. Les agences répondent elles-mêmes sur leurs campagnes."),
  emptyText: t("Les clippers peuvent poser une question depuis la fiche de chaque campagne de {brand} active ou en pause."),
});
