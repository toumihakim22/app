// Espace Admin (10/13) : leçons de l'Académie et table des vues de l'espace (ADMIN_VIEWS).
// Les fichiers de web/src/admin/ sont collés dans l'ordre de leur numéro par web/build.mjs (même portée).

// ---------- Académie ----------
// Tutoriels courts des clippers (db.lessons : toutes les leçons, brouillons compris, dans l'ordre d'affichage). Liste :
// place, titre, catégorie, langues traduites, publication (interrupteur), monter / descendre, modifier, supprimer
// (après confirmation). Éditeur (modale adm-lesson) : réglages, puis titre, résumé et contenu par langue (onglets
// Français obligatoire, English et العربية facultatifs : sans traduction, les clippers lisent le français).
const admLessons = () => db.lessons || [];
const admLessonById = (id) => admLessons().find((l) => l.id === id) || null;
const ADM_LESSON_LANGS = [["fr", "Français"], ["en", "English"], ["ar", "العربية"]];
// Corps envoyé à PUT /api/lessons/<id> à partir d'une leçon reçue (interrupteur de publication).
const admLessonPayload = (l, patch = {}) => ({
  category: l.category, emoji: l.emoji, minutes: l.minutes, videoUrl: l.videoUrl || null,
  title: l.title, summary: l.summary, body: l.body, published: l.published, ...patch,
});
// Langues écrites d'une leçon : pastille pleine si le titre, le résumé et le contenu sont traduits, en pointillé sinon.
function admLessonLangs(l) {
  return `<span class="inline-flex items-center gap-1">${["en", "ar"].map((k) => {
    const done = ["title", "summary", "body"].every((f) => l[f] && l[f][k] && String(l[f][k]).trim());
    const tip = done ? (k === "en" ? t("Traduite en anglais") : t("Traduite en arabe")) : (k === "en" ? t("Pas encore traduite en anglais : le français est affiché") : t("Pas encore traduite en arabe : le français est affiché"));
    return `<span title="${esc(tip)}" class="inline-flex h-5 items-center rounded-[4px] px-1.5 text-micro font-semibold ${done ? "bg-muted text-fg-muted" : "border border-dashed border-line-strong text-fg-subtle line-through"}"><span class="sr-only">${esc(tip)}</span><span aria-hidden="true">${k.toUpperCase()}</span></span>`;
  }).join("")}</span>`;
}
function aAcademie() {
  const list = admLessons(), live = list.filter((l) => l.published).length;
  const row = (l, i) => {
    const title = lsText(l.title), last = i === list.length - 1;
    const move = (dir, label, off) => `<button type="button" data-action="adm-lesson-move" data-id="${esc(l.id)}" data-value="${dir}" class="${iconBtn("sm", false, "disabled:pointer-events-none disabled:opacity-35")}" aria-label="${esc(label)}" title="${esc(label)}"${off ? " disabled" : ""}>${icon("chevronDown", dir === "up" ? "size-4 rotate-180" : "size-4")}</button>`;
    return `<li data-row="${esc(l.id)}" class="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <span class="w-5 shrink-0 text-center text-small font-medium tabular-nums text-fg-subtle">${fmt(i + 1)}</span>${lsTile(l, "sm")}
          <div class="min-w-0 flex-1">
            <button type="button" data-action="adm-lesson-edit" data-id="${esc(l.id)}" class="${HIT} block max-w-full truncate rounded-sm text-start text-sm font-medium text-fg underline-offset-2 hover:underline ${FOCUS}" dir="auto">${esc(title)}</button>
            <p class="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-fg-subtle"><span>${lsCat(l.category)}</span><span aria-hidden="true">·</span><span>${lsMinutes(l.minutes)}</span>${l.videoUrl ? `<span aria-hidden="true">·</span><span class="inline-flex items-center gap-1">${icon("play", "size-3")}${t("Vidéo")}</span>` : ""}<span aria-hidden="true">·</span>${admLessonLangs(l)}</p>
          </div>
        </div>
        <div class="flex items-center justify-between gap-3 ps-8 sm:shrink-0 sm:justify-end sm:ps-0">
          <span class="flex items-center gap-2">${switchBtn(l.published, "adm-lesson-publish", l.id, l.published ? t("Retirer « {title} » de l'Académie", { title }) : t("Publier « {title} »", { title }))}<span class="w-[4.5rem] text-xs ${l.published ? "text-fg-muted" : "text-fg-subtle"}">${l.published ? t("Publiée") : t("Brouillon")}</span></span>
          <span class="flex items-center gap-0.5">
            ${move("up", t("Monter"), i === 0)}${move("down", t("Descendre"), last)}
            <button type="button" data-action="adm-lesson-edit" data-id="${esc(l.id)}" class="${iconBtn("sm")}" aria-label="${esc(t("Modifier"))}" title="${esc(t("Modifier"))}">${icon("pencil", "size-4")}</button>
            <button type="button" data-action="adm-lesson-delete" data-id="${esc(l.id)}" class="${iconBtn("sm", false, "hover:text-danger-fg")}" aria-label="${esc(t("Supprimer"))}" title="${esc(t("Supprimer"))}">${icon("trash", "size-4")}</button>
          </span>
        </div>
      </li>`;
  };
  return `${pageHeader(t("Académie"), t("Les tutoriels courts proposés aux clippers, dans l'ordre affiché ici. Un brouillon n'est visible que par l'équipe."),
      `<button type="button" data-action="adm-lesson-new" class="${btn("primary")}">${icon("plus")}${t("Nouvelle leçon")}</button>`)}
    <p class="mt-6 text-small text-fg-muted">${list.length ? t("{published} · {drafts}", { published: plural(live, "leçon publiée", "leçons publiées"), drafts: plural(list.length - live, "brouillon", "brouillons") }) : ""}</p>
    <div class="mt-3">${list.length ? `<section class="${CARD}"><ul class="divide-y divide-line">${list.map(row).join("")}</ul></section>`
      : emptyState("academy", t("Aucune leçon"), t("Écrivez un premier tutoriel : il apparaîtra dans l'Académie des clippers dès sa publication."), `<button type="button" data-action="adm-lesson-new" class="${btn("secondary")}">${icon("plus")}${t("Nouvelle leçon")}</button>`)}</div>`;
}

// Éditeur d'une leçon (m.id : leçon modifiée ; absent : nouvelle leçon). m.tab : onglet de langue affiché. Les trois
// langues restent dans le formulaire (onglets masqués, pas retirés) : tout est envoyé ensemble.
function admLessonModal(m) {
  const l = m.id ? admLessonById(m.id) : null;
  if (m.id && !l) return admGone(t("Leçon introuvable"), t("Cette leçon a été supprimée."));
  const tab = ADM_LESSON_LANGS.some(([k]) => k === m.tab) ? m.tab : "fr";
  const v = (f, k) => (l && l[f] && l[f][k]) || "";
  const tabs = `<div class="${TABLIST} mt-6" role="tablist" aria-label="${esc(t("Langue du texte"))}">${ADM_LESSON_LANGS.map(([k, label]) => `<button type="button" role="tab" id="adm-lesson-tab-${k}" aria-controls="adm-lesson-panel-${k}" aria-selected="${k === tab}" data-action="adm-lesson-tab" data-value="${k}" class="${TAB}"><span lang="${k}">${label}</span>${k === "fr" ? `<span class="text-xs font-normal text-fg-subtle">${t("obligatoire")}</span>` : ""}</button>`).join("")}</div>`;
  const panel = ([k]) => {
    const dir = k === "ar" ? "rtl" : "ltr", req = k === "fr" ? " required" : "";
    return `<div role="tabpanel" id="adm-lesson-panel-${k}" aria-labelledby="adm-lesson-tab-${k}" class="mt-4 grid gap-4"${k === tab ? "" : " hidden"}>
        ${k === "fr" ? "" : alertBox("info", t("Facultatif : sans traduction, les clippers lisent le texte français."))}
        ${field(t("Titre"), `<input name="title_${k}" value="${esc(v("title", k))}" maxlength="120" dir="${dir}" lang="${k}"${req} autocomplete="off" class="${inputCls}"/>`)}
        ${field(t("Résumé"), `<textarea name="summary_${k}" rows="2" maxlength="300" dir="${dir}" lang="${k}"${req} class="${textareaCls} min-h-16">${esc(v("summary", k))}</textarea>`, t("Une ou deux phrases, affichées sur la carte de la leçon."))}
        ${field(t("Contenu"), `<textarea name="body_${k}" rows="12" maxlength="8000" dir="${dir}" lang="${k}"${req} class="${textareaCls} min-h-48">${esc(v("body", k))}</textarea>`,
          t("Ligne vide : nouveau paragraphe. « - » en début de ligne : puce. « 1. » : étape numérotée. Le texte s'affiche tel quel, sans HTML."))}
      </div>`;
  };
  const body = `<div class="grid gap-4 sm:grid-cols-[6rem_minmax(0,1fr)_8rem]">
      ${field(t("Emoji"), `<input name="emoji" value="${esc(l ? l.emoji : "🎬")}" maxlength="16" required autocomplete="off" class="${inputCls} text-center text-lg"/>`)}
      ${field(t("Catégorie"), `<input name="category" value="${esc(l ? l.category : "")}" list="adm-lesson-cats" maxlength="40" required autocomplete="off" class="${inputCls}"/><datalist id="adm-lesson-cats">${["Montage", "Accroche", "Formats", "Campagnes"].map((c) => `<option value="${c}">${esc(LS_CATS[c]())}</option>`).join("")}</datalist>`)}
      ${field(t("Durée"), unitInput(`name="minutes" value="${l ? fmt(l.minutes) : "3"}" required autocomplete="off"`, t("min")))}
    </div>
    <div class="mt-4">${field(`${t("Lien de la vidéo")} ${OPTIONAL}`, `<input name="videoUrl" type="url" value="${esc(l && l.videoUrl ? l.videoUrl : "")}" maxlength="500" dir="ltr" placeholder="https://www.youtube.com/watch?v=…" autocomplete="off" class="${inputCls}"/>`, t("Adresse https (YouTube, TikTok…) : un bouton « Voir la vidéo » l'ouvre depuis la leçon."))}</div>
    <label class="mt-4 flex cursor-pointer items-start gap-3"><input type="checkbox" name="published" ${!l || l.published ? "checked" : ""} class="${CHECKBOX} mt-0.5"/><span class="min-w-0"><span class="block text-sm font-medium text-fg">${t("Publiée")}</span><span class="block text-xs text-fg-subtle">${t("Visible par les clippers dans l'Académie. Décochée : brouillon, visible par l'équipe seulement.")}</span></span></label>
    ${tabs}${ADM_LESSON_LANGS.map(panel).join("")}`;
  return modalShell({
    title: l ? t("Modifier la leçon") : t("Nouvelle leçon"), description: l ? admQuoted(lsText(l.title)) : t("Elle est ajoutée à la fin de l'Académie."), size: "xl", form: "adm-lesson",
    body,
    footer: `<button type="button" data-action="close-modal" class="${btn("ghost")}">${t("Annuler")}</button><button type="submit" class="${btn("primary")}">${l ? t("Enregistrer") : t("Ajouter la leçon")}</button>`,
  });
}

const ADMIN_VIEWS = { apercu: aApercu, messages: aMessages, utilisateurs: aUtilisateurs, utilisateur: aUtilisateur, campagnes: aCampagnes, moderation: aModeration, retraits: aRetraits, classement: aClassement, academie: aAcademie, parametres: aParametres, compte: aCompte };
