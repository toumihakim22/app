// Espace Admin (11/13) : fiches d'examen d'une campagne et d'un clip.
// Les fichiers de web/src/admin/ sont collés dans l'ordre de leur numéro par web/build.mjs (même portée).

// ---------- Fiches d'examen ----------

const admTile = (label, value, sub = "", cls = "") => `<div class="${TILE} ${cls}"><dt class="text-xs text-fg-subtle">${label}</dt><dd class="mt-0.5 text-sm font-semibold tabular-nums text-fg">${value}${sub ? `<span class="mt-0.5 block text-xs font-normal text-fg-subtle">${sub}</span>` : ""}</dd></div>`;
const admH3 = (title, extra = "") => `<div class="mt-6 flex flex-wrap items-center justify-between gap-x-3 gap-y-2"><h3 class="text-section text-fg">${title}</h3>${extra}</div>`;
// Règles écrites par l'agence : texte libre, affiché tel quel (dir="auto" : une règle en arabe se lit de droite à gauche).
const admRules = (c) => (c.rules && c.rules.length
  ? `<ul class="mt-2 grid gap-2">${c.rules.map((r) => `<li class="flex gap-2.5 text-sm text-fg-muted">${icon("check", "mt-0.5 size-4 shrink-0 text-income")}<span class="min-w-0 break-words" dir="auto">${esc(r)}</span></li>`).join("")}</ul>`
  : `<p class="mt-2 text-sm text-fg-subtle">${t("Aucune règle particulière.")}</p>`);
const admPlatforms = (c) => `<div class="mt-2 flex flex-wrap gap-1.5">${PLATFORMS.filter((p) => (c.platforms || []).includes(p)).concat((c.platforms || []).filter((p) => !PLATFORMS.includes(p))).map(platformTag).join("")}</div>`;

// Dernière modification de la campagne par son agence (journal d'activité), pour l'examen d'une campagne en attente.
// Comparaison avec les textes français du serveur (jamais traduits ici : ce sont des clés, pas un affichage).
function admCampEdit(c, o) {
  if (!o) return null;
  const edited = `${o.name} a modifié la campagne « ${c.title} ».`, relaunched = `${o.name} a modifié et relancé la campagne « ${c.title} ».`;
  const a = (db.activity || []).find((x) => x.text === edited || x.text === relaunched);
  if (a) return { at: a.at, relaunch: a.text === relaunched };
  return c.updatedAt && c.updatedAt.slice(0, 10) !== c.createdAt ? { at: c.updatedAt, relaunch: false } : null;
}

// Indication sous le statut d'une campagne, dans la fiche d'examen.
function admCampHint(c, o, edit) {
  if (c.status === "En attente") {
    if (!edit) return t("Soumise le {date}, en attente de votre vérification.", { date: date(c.createdAt) });
    return edit.relaunch ? t("Relancée par l'agence le {date} après un refus : vérifiez ses corrections.", { date: date(edit.at) }) : t("Modifiée par l'agence le {date}.", { date: date(edit.at) });
  }
  if (c.status === "Active") return t("En ligne : visible par les clippers, qui peuvent la rejoindre et soumettre des clips.");
  if (c.status === "En pause") return t("En pause : elle n'accepte ni nouveaux clippers ni nouveaux clips.");
  if (c.status === "Terminée") return o ? t("Terminée : le budget non consommé a été rendu au crédit de l'agence.") : t("Terminée : elle n'accepte plus de clips.");
  if (c.status === "Refusée") return t("Refusée le {date}. L'agence peut la modifier et la relancer, ou la supprimer.", { date: date(c.updatedAt || c.createdAt) });
  return "";
}

// Fiche d'examen d'une campagne : photo, agence (fiche, badge, crédit), chiffres, financement, clips, plateformes,
// règles, mise en avant ; décisions selon le statut (approuver, refuser avec motif, pause, reprise, fin).
function admCampSheet(m) {
  const c = campaignById(m.id);
  if (!c) return admGone(t("Campagne introuvable"), t("Cette campagne a été annulée ou supprimée par son agence."));
  const o = c.ownerId ? userById(c.ownerId) : null, pending = c.status === "En attente", refused = c.status === "Refusée";
  const funded = !pending && !refused, closed = c.status === "Terminée" || refused;
  const cost = admFunding(c.budget, c.commissionRate), fee = cost - c.budget, credit = o ? o.credit || 0 : 0;
  const short = pending && o ? Math.max(0, cost - credit) : 0;
  const clips = db.publications.filter((p) => p.campaign === c.id);
  const edit = pending ? admCampEdit(c, o) : null;
  const commissionLabel = t("Commission {brand} ({rate} %)", { rate: c.commissionRate });

  const cover = `<div class="cover relative aspect-[16/9] overflow-hidden rounded-tile sm:aspect-[5/2]" ${coverAttr(c)}>${coverArt(c, "text-6xl")}
      <span class="absolute start-3 top-3 rounded-badge bg-night/80 px-2 py-1 text-small font-semibold tabular-nums text-on-brand backdrop-blur-sm"><span class="inline-flex items-baseline gap-1">${da(c.rate)}<span class="text-[11px] font-medium text-on-brand/80">${t("/ 1k vues")}</span></span></span>
      ${c.top ? `<span class="absolute bottom-3 start-3 inline-flex items-center gap-1 rounded-badge bg-on-brand/90 px-1.5 py-0.5 text-[11px] font-semibold text-night">${icon("star", "size-3", true)}${t("Top campagne")}</span>` : ""}</div>`;

  const status = `<div class="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">${statusBadge(c.status)}<span class="min-w-0 text-small text-fg-muted">${admCampHint(c, o, edit)}</span></div>`;
  const reason = refused && c.reviewNote ? `<div class="mt-4">${alertBox("danger", `<p class="font-medium">${t("Motif du refus")}</p><p class="mt-0.5 break-words" dir="auto">${esc(c.reviewNote)}</p>`)}</div>` : "";

  // Organisateur : l'agence (lien vers sa fiche, badge, contact, crédit actuel), sinon ClipBoost.
  const org = o
    ? `<div class="mt-4 flex items-center gap-3 rounded-tile border border-line p-3">${avatar(o, "md")}
        <div class="min-w-0 flex-1"><p class="text-xs text-fg-subtle">${t("Agence")}</p>
          <p class="flex min-w-0 text-sm font-medium text-fg">${admUserLink(o, "", { inModal: true })}</p>
          <p class="truncate text-xs text-fg-subtle"><span dir="ltr">${esc(o.email || "")}</span>${o.contact ? ` · <span dir="auto">${esc(o.contact)}</span>` : ""}</p></div>
        <div class="shrink-0 text-end"><p class="text-xs text-fg-subtle">${t("Crédit")}</p><p class="text-sm font-semibold">${money(credit)}</p></div></div>`
    : `<div class="mt-4 flex items-center gap-3 rounded-tile border border-line p-3"><span class="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-on-brand">${icon("play", "size-4 translate-x-px", true)}</span>
        <div class="min-w-0"><p class="text-xs text-fg-subtle">${t("Organisateur")}</p><p class="text-sm font-medium text-fg">${c.ownerId ? t("Agence supprimée") : t("Campagne gérée par {brand}")}</p></div></div>`;

  // Catégorie hors liste : précisée par l'agence (« Autre »), affichée telle quelle.
  const custom = !CATEGORIES.includes(c.category);
  const facts = `<dl class="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
      <div class="min-w-0"><dt class="text-xs text-fg-subtle">${t("Marque")}</dt><dd class="mt-0.5 break-words font-medium text-fg">${esc(c.brand)}</dd></div>
      <div class="min-w-0"><dt class="text-xs text-fg-subtle">${t("Catégorie")}</dt><dd class="mt-0.5 break-words font-medium text-fg">${esc(t(c.category))}${custom ? `<span class="block text-xs font-normal text-fg-subtle">${t("« Autre », précisée par l'agence")}</span>` : ""}</dd></div>
      <div class="min-w-0"><dt class="text-xs text-fg-subtle">${t("Créée le")}</dt><dd class="mt-0.5 font-medium tabular-nums text-fg">${date(c.createdAt)}</dd></div>
      <div class="min-w-0"><dt class="text-xs text-fg-subtle">${t("Dernière mise à jour")}</dt><dd class="mt-0.5 font-medium tabular-nums text-fg">${date(c.updatedAt || c.createdAt)}</dd></div>
    </dl>`;

  const pay = `${admH3(t("Rémunération des clippers"))}
    <dl class="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
      ${admTile(t("Tarif"), da(c.rate), t("pour 1 000 vues · 100 000 vues = {amount}", { amount: da(c.rate * 100) }), "col-span-2 sm:col-span-1")}
      ${admTile(t("Seuil par clip"), da(c.minPayout), t("payé dès {views}", { views: plural(viewsFor(c, c.minPayout), "vue", "vues") }))}
      ${admTile(t("Plafond par clip"), da(c.maxPayout), t("atteint à {views}", { views: plural(viewsFor(c, c.maxPayout), "vue", "vues") }))}
    </dl>`;

  // Financement : ce qui sera débité à l'approbation (et le crédit de l'agence), ou ce qui a été consommé.
  const waiting = o ? admSum(pendingRecharges().filter((tx) => tx.userId === o.id), (tx) => tx.amount) : 0;
  const payLink = `<a href="#/admin/retraits" data-action="adm-focus" data-value="recharges" class="${btn("link")}">${t("Voir dans Paiements")}</a>`;
  let money_;
  if (pending || refused) {
    const shortAlert = () => alertBox("warning", `<p><strong class="font-semibold">${t("Crédit de l'agence insuffisant.")}</strong> ${t("{credit} disponibles : il manque {missing}. L'approbation sera possible dès que l'agence aura rechargé son crédit.", { credit: da(credit), missing: `<strong class="font-semibold tabular-nums">${da(short)}</strong>` })}</p>${waiting
      ? `<p class="mt-1">${waiting >= short ? t("Une recharge de {amount} attend votre confirmation, ce qui suffirait.", { amount: da(waiting) }) : t("Une recharge de {amount} attend votre confirmation.", { amount: da(waiting) })} ${payLink}</p>` : ""}`);
    money_ = o
      ? `${summary([[t("Budget de la campagne"), money(c.budget)], [commissionLabel, money(fee)], [refused ? t("Aurait été débité à l'approbation") : t("Débité à l'approbation"), money(cost), true]])}
        ${pending ? (short
          ? `<div class="mt-3" id="adm-credit-short">${shortAlert()}</div>`
          : `<p class="mt-3 text-xs tabular-nums text-fg-subtle">${t("Crédit actuel de l'agence : {credit}. Il restera {left} après l'approbation.", { credit: da(credit), left: da(credit - cost) })}</p>`)
          : `<p class="mt-3 text-xs text-fg-subtle">${t("Rien n'a été débité du crédit de l'agence.")}</p>`}`
      : summary([[t("Budget de la campagne"), money(c.budget)], [t("Commission {brand}"), t("Aucune")]]);
  } else {
    const remaining = Math.max(0, c.budget - c.spent);
    money_ = `<div class="mt-2">${progress(c.spent, c.budget, { aria: t("Budget consommé de {title}", { title: c.title }) })}</div>
      ${summary([[t("Budget"), money(c.budget)], [t("Consommé (gains des clippers)"), money(c.spent)],
        [c.status === "Terminée" ? (o ? t("Rendu à l'agence") : t("Non consommé")) : t("Restant"), money(remaining)],
        o ? [commissionLabel, money(Math.round((c.spent * c.commissionRate) / 100))] : [t("Commission {brand}"), t("Aucune")]])}`;
  }
  const budget = `${admH3(t("Budget et financement"))}${money_}`;

  // Clips reçus (campagne en ligne ou terminée) : chacun ouvre sa fiche par-dessus celle-ci.
  const toModerate = clips.filter((p) => p.status === "En attente").length;
  const clipList = !funded ? "" : `${admH3(t("Clips"))}
    <dl class="mt-2 grid grid-cols-3 gap-2">
      ${admTile(t("Clippers"), fmt(c.clippers), t("ont rejoint"))}
      ${admTile(t("Clips reçus"), fmt(clips.length), toModerate ? t("{n} à modérer", { n: fmt(toModerate) }) : t("tout est modéré"))}
      ${admTile(t("Vues validées"), compact(admSum(clips.filter((p) => p.status === "Validée"), (p) => p.views)), t("sur les clips validés"))}
    </dl>
    ${clips.length ? `<ul class="mt-3 divide-y divide-line overflow-hidden rounded-tile border border-line">${clips.slice(0, 5).map((p) => {
      const cu = userById(p.userId);
      return `<li><button type="button" data-action="adm-clip" data-id="${p.id}" class="flex w-full items-center gap-3 px-3 py-2.5 text-start transition-colors duration-150 hover:bg-subtle ${FOCUS_INSET}">
        <span class="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-fg-muted" aria-hidden="true">${icon(PLATFORM_ICON[p.platform] || "film", "size-4")}</span>
        <span class="min-w-0 flex-1"><span class="block truncate text-sm font-medium text-fg">${esc(p.title)}</span><span class="block truncate text-xs tabular-nums text-fg-subtle">${esc(cu ? cu.name : t("Compte supprimé"))} · ${plural(p.views, "vue", "vues")} · ${date(p.date)}</span></span>
        ${statusBadge(p.status)}</button></li>`;
    }).join("")}</ul>${clips.length > 5 ? `<p class="mt-2 text-xs text-fg-subtle">${t("{count} dans la modération.", { count: plural(clips.length - 5, "autre clip", "autres clips") })}</p>` : ""}`
      : `<p class="mt-3 rounded-tile border border-dashed border-line-strong px-4 py-5 text-center text-small text-fg-muted">${t("Aucun clip reçu pour l'instant.")}</p>`}`;

  const top = closed ? "" : `<div class="mt-6 flex items-center justify-between gap-6 rounded-tile border border-line p-3.5">
      <div class="min-w-0"><p class="flex items-center gap-1.5 text-sm font-medium text-fg">${icon("star", "size-4 shrink-0 text-fg-subtle")}${t("Top campagne")}</p>
        <p class="mt-0.5 text-xs text-fg-subtle">${pending ? t("Mise en avant en tête de Découvrir et de l'accueil public, dès son approbation.") : t("Mise en avant en tête de Découvrir et de l'accueil public.")}</p></div>
      ${switchBtn(!!c.top, "adm-camp-top", c.id, t("Top campagne"))}</div>`;

  const b = (action, variant, label, extra = "") => `<button type="button" data-action="${action}" data-id="${c.id}" class="${btn(variant)}"${extra}>${label}</button>`;
  const close = `<button type="button" data-action="close-modal" class="${btn(closed ? "secondary" : "ghost")}">${t("Fermer")}</button>`;
  const footer = close + (
    pending ? b("adm-camp-refuse", "dangerSoft", t("Refuser")) + b("adm-camp-approve", "primary", `${icon("check")}${t("Approuver")}`, short ? ` disabled aria-describedby="adm-credit-short" title="${esc(t("Crédit de l'agence insuffisant"))}"` : "")
    : c.status === "Active" ? b("adm-camp-end", "dangerSoft", t("Terminer")) + b("adm-camp-pause", "secondary", `${icon("pause")}${t("Mettre en pause")}`)
    : c.status === "En pause" ? b("adm-camp-end", "dangerSoft", t("Terminer")) + b("adm-camp-resume", "primary", `${icon("play")}${t("Reprendre")}`)
    : "");

  return modalShell({
    title: esc(c.title), description: `${esc(c.brand)} · ${esc(t(c.category))}`, size: "xl", footer,
    body: `${cover}${status}${reason}${org}${facts}${pay}${budget}${clipList}
      ${admH3((c.platforms || []).length > 1 ? t("Plateformes acceptées") : t("Plateforme acceptée"))}${admPlatforms(c)}
      ${admH3(t("Règles de la campagne"))}${admRules(c)}
      ${top}`,
  });
}

// Lien de la vidéo d'un clip (copier, ouvrir sur sa plateforme) : fiche d'examen du clip et fiche d'un recours.
function admClipLinkBox(p) {
  const ic = PLATFORM_ICON[p.platform] || "film", platform = esc(p.platform);
  return `<div class="flex flex-col gap-3 rounded-tile border border-line p-3 sm:flex-row sm:items-center">
      <div class="flex min-w-0 flex-1 items-center gap-3">
        <span class="grid size-10 shrink-0 place-items-center rounded-tile bg-muted text-fg" aria-hidden="true">${icon(ic, "size-5")}</span>
        <div class="min-w-0 flex-1"><p class="text-xs text-fg-subtle">${t("Lien {platform}", { platform })}</p>
          <p class="mt-0.5 flex min-w-0 items-center gap-0.5"><span class="min-w-0 break-all font-mono text-small text-fg" dir="ltr">${esc(p.url || "")}</span>${p.url ? admCopyBtn(p.url, t("Copier le lien"), t("Lien copié")) : ""}</p></div>
      </div>
      ${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" class="${btn("secondary", "md", "shrink-0")}">${icon("external")}${t("Ouvrir sur {platform}", { platform })}</a>` : ""}
    </div>`;
}
// Clipper (lien vers son profil) et campagne (sa fiche, par-dessus) d'un clip : fiche du clip et fiche d'un recours.
function admClipPeople(p, c) {
  const u = userById(p.userId), o = c.ownerId ? userById(c.ownerId) : null;
  return `<div class="mt-4 grid gap-2 sm:grid-cols-2">
      <div class="flex min-w-0 items-center gap-3 rounded-tile border border-line p-3">${u ? avatar(u, "md") : avatar({ id: p.userId, name: "?", role: "clipper" }, "md")}
        <div class="min-w-0 flex-1"><p class="text-xs text-fg-subtle">${t("Clipper")}</p><p class="flex min-w-0 text-sm font-medium text-fg">${admUserLink(u, "", { inModal: true })}</p>
          <p class="truncate text-xs text-fg-subtle">${u ? `${esc(t(u.level || "Clipper"))}${u.handle ? ` · <span dir="ltr">${esc(u.handle)}</span>` : ""}` : ""}</p></div></div>
      <button type="button" data-action="adm-camp" data-id="${c.id}" class="flex min-w-0 items-center gap-3 rounded-tile border border-line p-3 text-start transition-colors duration-150 hover:border-line-strong hover:bg-subtle ${FOCUS}">${coverThumb(c, "sm")}
        <span class="min-w-0 flex-1"><span class="block text-xs text-fg-subtle">${t("Campagne")}</span><span class="block truncate text-sm font-medium text-fg">${esc(c.title)}</span>
          <span class="block truncate text-xs text-fg-subtle">${esc(o ? o.name : c.brand)} · ${rateShort(c.rate)}</span></span>${icon("chevronRight", "size-4 shrink-0 text-fg-subtle rtl:-scale-x-100")}</button>
    </div>`;
}

// Fiche d'examen d'un clip : lien de la vidéo (ouvrir, copier), clipper (fiche), campagne (sa fiche), vues, seuil et
// plafond, gain estimé ou crédité, risque de fraude et historique des vues, autres plateformes du même envoi, motif d'un
// refus ; décision (valider, refuser).
function admClipSheet(m) {
  const p = db.publications.find((x) => x.id === m.id), c = p && campaignById(p.campaign);
  if (!p || !c) return admGone(t("Clip introuvable"), t("Ce clip n'existe plus."));
  const pending = p.status === "En attente", validated = p.status === "Validée", appeal = admAppealOf(p);
  const seuil = viewsFor(c, c.minPayout), cap = viewsFor(c, c.maxPayout);
  // Même calcul que le serveur (lib/server/rules.ts) : gain brut arrondi, rien sous le seuil, plafond, budget restant.
  const raw = Math.floor((p.views * c.rate) / 1000), under = raw < c.minPayout, capped = raw >= c.maxPayout;
  const due = under ? 0 : Math.min(raw, c.maxPayout), remaining = Math.max(0, c.budget - c.spent), est = Math.min(due, remaining);
  const siblings = p.batch ? db.publications.filter((x) => x.batch === p.batch && x.id !== p.id) : [];
  const platform = esc(p.platform);
  const linkBox = admClipLinkBox(p), people = admClipPeople(p, c);

  const status = `<div class="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">${statusBadge(p.status)}<span class="text-small text-fg-muted">${pending && under ? t("Soumis le {date} · seuil de paiement pas encore atteint", { date: date(p.date) }) : t("Soumis le {date}", { date: date(p.date) })}</span></div>`;
  // Motif d'un refus : un des motifs proposés (français, traduit par tServer) ou un texte libre (affiché tel quel).
  const reason = p.status === "Refusée" && p.reason ? `<div class="mt-4">${alertBox("danger", `<p class="font-medium">${t("Motif du refus")}</p><p class="mt-0.5 break-words" dir="auto">${esc(tServer(p.reason))}</p>`)}</div>` : "";
  // Recours du clipper sur ce refus : statut et accès à sa fiche (décision, message, preuve).
  const appealBox = appeal ? `<div class="mt-4 flex flex-col gap-3 rounded-tile border border-line p-3 sm:flex-row sm:items-center">
      <div class="flex min-w-0 flex-1 items-center gap-3"><span class="grid size-10 shrink-0 place-items-center rounded-tile bg-info-bg text-info-fg" aria-hidden="true">${icon("flag", "size-5")}</span>
        <div class="min-w-0 flex-1"><p class="text-sm font-medium text-fg">${t("Le clipper conteste ce refus")}</p><p class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">${appealBadge(appeal.status)}<span>${t("Envoyé le {date}", { date: date(appeal.createdAt) })}</span></p></div></div>
      <button type="button" data-action="adm-appeal" data-id="${appeal.id}" class="${btn(appeal.status === "En attente" ? "primary" : "secondary", "md", "shrink-0")}">${appeal.status === "En attente" ? t("Examiner le recours") : t("Voir le recours")}</button>
    </div>` : "";
  const ended = pending && c.status === "Terminée" ? `<div class="mt-4">${alertBox("warning", t("La campagne est terminée : son budget non consommé a été rendu à l'agence. Vérifiez avant de valider ce clip."))}</div>` : "";


  const viewsBtn = pending || validated ? `<button type="button" data-action="adm-views" data-id="${p.id}" class="${btn("secondary", "sm")}">${icon("eye")}${t("Relever les vues")}</button>` : "";
  const threshold = under && !validated ? `<div class="mt-3">${progress(p.views, seuil, { label: false, aria: t("Progression vers le seuil") })}
      <p class="mt-1.5 text-xs tabular-nums text-fg-subtle">${t("{pct} du seuil : il manque {views}.", { pct: pct(Math.min(99, Math.floor((p.views / Math.max(1, seuil)) * 100))), views: plural(seuil - p.views, "vue", "vues") })}</p></div>` : "";
  const capNote = (txt) => `<span class="ms-1.5 text-xs font-normal text-fg-subtle">${txt}</span>`;
  const rows = [[t("Tarif"), rate(c.rate)], [t("Gain brut des vues"), money(raw)]];
  if (pending) {
    rows.push([t("Gain estimé à la validation"), under ? `<span class="font-normal text-fg-subtle">${t("— sous le seuil")}</span>`
      : `${money(est)}${est < due ? capNote(t("budget restant")) : capped ? capNote(t("plafond")) : ""}`, true]);
  } else if (validated) rows.push([t("Crédité au clipper"), `${money(p.paid || 0)}${capped ? capNote(t("plafond")) : ""}`, true]);
  else rows.push([t("Gain"), `<span class="font-normal text-fg-subtle">${t("Aucun : clip refusé")}</span>`, true]);
  const payout = `${admH3(t("Vues et gain"), viewsBtn)}
    <dl class="mt-2 grid grid-cols-3 gap-2">
      ${admTile(t("Vues relevées"), fmt(p.views))}
      ${admTile(t("Seuil"), plural(seuil, "vue", "vues"), da(c.minPayout))}
      ${admTile(t("Plafond"), plural(cap, "vue", "vues"), da(c.maxPayout))}
    </dl>${threshold}${summary(rows)}
    ${validated ? `<p class="mt-2 text-xs text-fg-subtle">${t("Les vues relevées pendant {days} après la validation sont payées en plus, dans la limite du plafond et du budget restant.", { days: plural(db.settings.earningDays, "jour", "jours") })}</p>` : ""}`;

  // Autres plateformes du même envoi : leur fiche remplace celle-ci (même fiche de retour).
  const batch = siblings.length ? `${admH3(t("Publié aussi sur"))}
    <ul class="mt-2 grid gap-2">${siblings.map((s) => `<li><button type="button" data-action="adm-clip" data-id="${s.id}" class="flex w-full items-center gap-3 rounded-tile border border-line p-3 text-start transition-colors duration-150 hover:border-line-strong hover:bg-subtle ${FOCUS}">
        <span class="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-fg-muted" aria-hidden="true">${icon(PLATFORM_ICON[s.platform] || "film", "size-4")}</span>
        <span class="min-w-0 flex-1"><span class="block text-sm font-medium text-fg">${esc(s.platform)}</span><span class="block truncate text-xs tabular-nums text-fg-subtle">${plural(s.views, "vue", "vues")}</span></span>
        ${statusBadge(s.status)}${icon("chevronRight", "size-4 shrink-0 text-fg-subtle rtl:-scale-x-100")}</button></li>`).join("")}</ul>` : "";

  const rules = `<details class="group mt-6" ${pending ? "open" : ""}>
      <summary class="flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm text-section text-fg [&::-webkit-details-marker]:hidden ${FOCUS}">${t("Règles de la campagne")}${icon("chevronDown", "size-4 shrink-0 text-fg-subtle transition-transform duration-150 group-open:rotate-180")}</summary>
      ${admRules(c)}
      <div class="mt-3 flex flex-wrap items-center gap-1.5"><span class="text-xs text-fg-subtle">${t("Plateformes acceptées :")}</span>${admPlatforms(c).replace('<div class="mt-2 flex flex-wrap gap-1.5">', "").replace(/<\/div>$/, "")}</div>
    </details>`;

  const footer = `<button type="button" data-action="close-modal" class="${btn(pending ? "ghost" : "secondary")}">${t("Fermer")}</button>${pending
    ? `<button type="button" data-action="adm-reject" data-id="${p.id}" class="${btn("dangerSoft")}">${t("Refuser")}</button>
      <button type="button" data-action="adm-validate" data-id="${p.id}" class="${btn("primary")}"${under ? ` disabled title="${esc(t("Seuil non atteint : {views} minimum", { views: plural(seuil, "vue", "vues") }))}"` : ""}>${icon("check")}${t("Valider")}</button>` : ""}`;

  return modalShell({
    title: esc(p.title), description: `${platform} · ${esc(c.title)}`, size: "xl", footer,
    body: `${linkBox}${status}${reason}${appealBox}${ended}${people}${payout}${admRiskPanel(p)}${batch}${rules}`,
  });
}

// Fiche d'un recours (contestation d'un clip refusé) : le clip (lien, plateforme, vues, campagne), le motif du refus
// d'origine, le message du clipper, sa preuve (agrandie au clic, proportions gardées) et le risque de fraude du clip ;
// en attente : « Refuser » ou « Accepter » (motif obligatoire, modale par-dessus). Accepter valide le clip comme une
// validation normale : impossible si la campagne ne paie plus ou si le seuil n'est pas atteint (bouton désactivé,
// le serveur le refuse aussi). Décidé : la décision, son auteur et son motif.
function admAppealCheck(p, c) {
  const raw = Math.floor((p.views * c.rate) / 1000), under = raw < c.minPayout, ended = !["Active", "En pause"].includes(c.status);
  const due = under ? 0 : Math.max(0, Math.min(raw, c.maxPayout) - (p.paid || 0)), est = Math.min(due, Math.max(0, c.budget - c.spent));
  const blocked = ended ? t("Cette campagne est terminée : ce clip ne peut plus être validé.")
    : under ? t("Seuil non atteint : {views} minimum", { views: plural(viewsFor(c, c.minPayout), "vue", "vues") }) : "";
  return { under, ended, est, blocked };
}
function admAppealSheet(m) {
  const a = admAppeals().find((x) => x.id === m.id), p = a && db.publications.find((x) => x.id === a.publicationId), c = p && campaignById(p.campaign);
  if (!a || !p || !c) return admGone(t("Recours introuvable"), t("Ce recours n'existe plus."));
  const u = admUser(a.userId), pending = a.status === "En attente", { under, est, blocked } = admAppealCheck(p, c);
  const decider = a.decidedBy ? admUser(a.decidedBy) : null;
  const status = `<div class="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">${appealBadge(a.status)}<span class="text-small text-fg-muted">${t("Envoyé le {date}", { date: date(a.createdAt) })}</span>
      <button type="button" data-action="adm-clip" data-id="${p.id}" class="${btn("link", "", "ms-auto text-small")}">${t("Fiche d'examen du clip")}</button></div>`;
  const decision = pending ? ""
    : `<div class="mt-4">${alertBox(a.status === "Acceptée" ? "success" : "danger", `<p class="font-medium">${a.status === "Acceptée"
        ? t("Recours accepté le {date} par {name} : le clip est validé.", { date: date(a.decidedAt), name: esc(decider ? decider.name : BRAND) })
        : t("Recours refusé le {date} par {name} : le clip reste refusé.", { date: date(a.decidedAt), name: esc(decider ? decider.name : BRAND) })}</p>${a.decisionNote ? `<p class="mt-0.5 break-words" dir="auto">${t("Motif : {reason}", { reason: esc(a.decisionNote) })}</p>` : ""}`)}</div>`;
  const tiles = `${admH3(t("Le clip"))}
    <dl class="mt-2 grid grid-cols-3 gap-2">
      ${admTile(t("Vues relevées"), fmt(p.views), t("seuil {views}", { views: fmt(viewsFor(c, c.minPayout)) }))}
      ${admTile(t("Statut du clip"), statusBadge(p.status))}
      ${admTile(pending ? t("Gain si accepté") : t("Gain"), p.status === "Validée" ? money(p.paid || 0) : under ? `<span class="font-normal text-fg-subtle">${t("— sous le seuil")}</span>` : money(est))}
    </dl>
    ${pending && blocked ? `<div class="mt-3">${alertBox("warning", `${esc(blocked)} ${t("Le recours ne peut pas être accepté pour le moment : refusez-le ou attendez un nouveau relevé des vues.")}`)}</div>` : ""}`;
  const refusal = p.reason ? `<div class="mt-4">${alertBox("danger", `<p class="font-medium">${t("Motif du refus d'origine")}</p><p class="mt-0.5 break-words" dir="auto">${esc(tServer(p.reason))}</p>`)}</div>` : "";
  const message = `${admH3(t("Message du clipper"))}
    <div class="mt-2 ${TILE}"><p class="whitespace-pre-line break-words text-sm text-fg" dir="auto">${esc(a.message)}</p></div>`;
  const proof = a.proof ? `${admH3(t("Preuve"))}
    <button type="button" data-action="adm-proof" data-id="${a.id}" class="group relative mt-2 block h-56 w-full overflow-hidden rounded-tile bg-muted ${FOCUS}" aria-label="${esc(t("Agrandir la preuve"))}">
      <img src="${esc(a.proof)}" alt="${esc(t("Capture d'écran jointe au recours"))}" class="absolute inset-0 size-full object-contain"/>
      <span class="absolute bottom-2 end-2 inline-flex items-center gap-1 rounded-badge bg-surface/90 px-2 py-1 text-xs font-medium text-fg shadow-control">${icon("search", "size-3.5")}${t("Agrandir")}</span></button>` : "";
  const footer = `<button type="button" data-action="close-modal" class="${btn(pending ? "ghost" : "secondary")}">${t("Fermer")}</button>${pending
    ? `<button type="button" data-action="adm-appeal-decide" data-id="${a.id}" data-value="refuse" class="${btn("dangerSoft")}">${t("Refuser le recours")}</button>
      <button type="button" data-action="adm-appeal-decide" data-id="${a.id}" data-value="approve" class="${btn("primary")}"${blocked ? ` disabled title="${esc(blocked)}"` : ""}>${icon("check")}${t("Accepter le recours")}</button>` : ""}`;
  return modalShell({
    title: t("Recours sur « {title} »", { title: `<bdi>${esc(p.title)}</bdi>` }), description: `${esc(u.name)} · ${esc(p.platform)} · ${esc(c.title)}`, size: "xl", footer,
    body: `${admClipLinkBox(p)}${status}${decision}${admClipPeople(p, c)}${tiles}${refusal}${message}${proof}${admRiskPanel(p)}`,
  });
}
