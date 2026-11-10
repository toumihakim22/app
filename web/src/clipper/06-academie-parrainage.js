// Espace Clipper (6/9) : académie et parrainage.
// Les fichiers de web/src/clipper/ sont collés dans l'ordre de leur numéro par web/build.mjs (même portée).

// ---------- Parrainage ----------
// Lien de parrainage du clipper (champ, « Copier », partage WhatsApp), règle de la prime (réglage referralBonus), chiffres
// clés et liste des filleuls (db.referral). La prime est versée au premier retrait validé de chaque filleul.

// Lien d'inscription avec le code : l'adresse de l'app (/espace en ligne, le fichier HTML hors ligne), sans paramètres.
const clReferralLink = (refCode) => `${location.href.split(/[?#]/)[0]}?ref=${encodeURIComponent(refCode)}#/inscription`;

// ---------- Académie ----------
// Tutoriels courts écrits par l'équipe (db.lessons : leçons publiées, dans l'ordre choisi par l'admin). Liste avec puces
// de catégorie ; leçon ouverte à l'adresse #/clipper/academie/<id> (ITEM_PAGES dans main.js : rechargement possible).
// Textes de la leçon dans la langue de l'interface, sinon en français (lsText, ui.js) ; dir="auto" : un texte resté en
// français se lit de gauche à droite dans l'interface arabe.
const clLessonHref = (l) => `#/clipper/academie/${encodeURIComponent(l.id)}`;
const clLessonMeta = (l) => `<span class="font-medium text-brand-fg">${lsCat(l.category)}</span><span aria-hidden="true">·</span><span class="inline-flex items-center gap-1">${icon("clock", "size-3.5")}${lsMinutes(l.minutes)}</span>${l.videoUrl ? `<span aria-hidden="true">·</span><span class="inline-flex items-center gap-1">${icon("play", "size-3.5")}${t("Vidéo")}</span>` : ""}`;
function clLessonCard(l) {
  return `<a href="${clLessonHref(l)}" data-row="${esc(l.id)}" class="${CARD} ${CARD_HOVER} flex flex-col p-5">
      <div class="flex items-start gap-3">${lsTile(l)}
        <div class="min-w-0 flex-1"><p class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-fg-subtle">${clLessonMeta(l)}</p>
          <h2 class="mt-1 text-sm font-semibold leading-5 text-fg" dir="auto">${esc(lsText(l.title))}</h2></div>
      </div>
      <p class="mt-3 line-clamp-3 text-small text-fg-muted" dir="auto">${esc(lsText(l.summary))}</p>
      <span class="mt-auto inline-flex items-center gap-1 pt-4 text-small font-medium text-brand-fg">${t("Lire la leçon")}${icon("chevronRight", "size-3.5 rtl:-scale-x-100")}</span>
    </a>`;
}
function cAcademie() {
  const all = db.lessons || [];
  if (state.route.item) return clLessonPage(all, state.route.item);
  const cats = [...new Set(all.map((l) => l.category))];
  const cat = cats.includes(state.acad.category) ? state.acad.category : "Toutes";
  const list = cat === "Toutes" ? all : all.filter((l) => l.category === cat);
  const options = [["Toutes", t("Toutes"), all.length], ...cats.map((c) => [c, LS_CATS[c] ? LS_CATS[c]() : c, all.filter((l) => l.category === c).length])];
  return `${pageHeader(t("Académie"), t("Des tutoriels courts pour monter vos clips, accrocher dès les premières secondes et choisir les formats qui marchent."))}
    ${all.length ? `<div class="mt-6">${chips("cl-acad-cat", cat, options, t("Catégorie"))}</div>
      <div class="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:gap-5 xl:grid-cols-3">${list.map(clLessonCard).join("")}</div>`
      : `<div class="mt-6">${emptyState("academy", t("Aucune leçon pour le moment"), t("L'équipe {brand} publiera bientôt de nouveaux tutoriels."))}</div>`}`;
}
// Leçon ouverte : en-tête, corps mis en forme (HTML échappé par le serveur), vidéo éventuelle, leçon suivante et autres leçons.
function clLessonPage(all, id) {
  const back = `<a href="#/clipper/academie" class="${btn("link", "", "text-small")}">${icon("arrowLeft", "size-4 rtl:-scale-x-100")}${t("Toutes les leçons")}</a>`;
  const i = all.findIndex((x) => x.id === id), l = all[i];
  if (!l) return `${back}<div class="mt-4">${emptyState("academy", t("Leçon introuvable"), t("Cette leçon n'existe plus ou n'est plus publiée."), `<a href="#/clipper/academie" class="${btn("secondary")}">${t("Voir l'Académie")}</a>`)}</div>`;
  const next = all[i + 1] || null, others = all.filter((x) => x.id !== l.id);
  const video = l.videoUrl ? `<a href="${esc(l.videoUrl)}" target="_blank" rel="noopener noreferrer" class="${btn("secondary")}">${icon("play")}${t("Voir la vidéo")}${icon("external", "size-3.5 text-fg-subtle")}</a>` : "";
  const article = card(`<div class="${LS_BODY}" dir="auto">${lsHtml(l)}</div>
      ${video ? `<div class="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5"><p class="min-w-0 flex-1 text-small text-fg-muted">${t("La démonstration en vidéo, sur le site de la plateforme.")}</p>${video}</div>` : ""}`, "p-5 sm:p-6");
  const nextCard = next ? `<a href="${clLessonHref(next)}" class="${CARD} ${CARD_HOVER} flex items-center gap-3 p-4">${lsTile(next, "sm")}
      <span class="min-w-0 flex-1"><span class="block text-xs text-fg-subtle">${t("Leçon suivante")}</span><span class="block truncate text-sm font-medium text-fg" dir="auto">${esc(lsText(next.title))}</span></span>${icon("chevronRight", "size-4 shrink-0 text-fg-subtle rtl:-scale-x-100")}</a>` : "";
  const side = others.length ? card(`${cardHeader(t("Autres leçons"))}<ul class="mt-3 grid gap-1">${others.map((x) => `<li><a href="${clLessonHref(x)}" class="flex items-center gap-3 rounded-tile p-2 transition-colors duration-150 hover:bg-subtle ${FOCUS}">${lsTile(x, "sm")}<span class="min-w-0 flex-1"><span class="block truncate text-small font-medium text-fg" dir="auto">${esc(lsText(x.title))}</span><span class="block text-xs text-fg-subtle">${lsCat(x.category)} · ${lsMinutes(x.minutes)}</span></span></a></li>`).join("")}</ul>`, "p-5") : "";
  return `${back}
    <div class="mt-4 flex items-start gap-4">${lsTile(l, "lg")}
      <div class="min-w-0 flex-1"><p class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-small text-fg-subtle">${clLessonMeta(l)}</p>
        <h1 class="mt-1 text-title-sm text-fg sm:text-title" dir="auto">${esc(lsText(l.title))}</h1>
        <p class="mt-1 max-w-2xl text-sm text-fg-muted" dir="auto">${esc(lsText(l.summary))}</p></div>
    </div>
    <div class="mt-6 grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-5">
      <div class="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4 lg:gap-5">${article}${nextCard}</div>
      <div class="grid content-start gap-4 lg:gap-5">${side}</div>
    </div>`;
}

function cParrainage() {
  const r = db.referral, bonus = db.settings.referralBonus || 0, hold = db.settings.holdDays;
  if (!r || !r.code) return `${pageHeader(t("Parrainage"), "")}<div class="mt-6">${emptyState("gift", t("Parrainage indisponible"), t("Rechargez la page pour afficher votre lien de parrainage."))}</div>`;
  const url = clReferralLink(r.code);
  const share = `https://wa.me/?text=${encodeURIComponent(t("Rejoins-moi sur {brand} : publie des clips et sois payé à la vue. Inscris-toi avec mon lien : {link}", { link: url }))}`;
  const rule = bonus > 0 ? t("Recevez {montant} quand votre filleul fait son premier retrait", { montant: `<strong class="font-semibold">${da(bonus)}</strong>` }) : t("Aucune prime de parrainage pour le moment : invitez quand même vos amis, la prime pourra revenir.");

  const linkCard = card(`${cardHeader(t("Votre lien de parrainage"), t("Partagez-le avec d'autres clippers : ils s'inscrivent sur {brand} avec votre code."))}
    <div class="mt-4 flex flex-col gap-2 sm:flex-row">
      <label class="min-w-0 flex-1"><span class="sr-only">${t("Lien de parrainage")}</span><input readonly value="${esc(url)}" dir="ltr" class="${inputCls} truncate font-mono text-small"/></label>
      <div class="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
        <button type="button" data-action="cl-ref-copy" data-value="${esc(url)}" class="${btn("primary")}">${icon("copy")}${t("Copier")}</button>
        <a href="${esc(share)}" target="_blank" rel="noopener" class="${btn("secondary")}">${icon("send", "size-4 rtl:-scale-x-100")}${t("WhatsApp")}</a>
      </div>
    </div>
    <p class="mt-3 text-small text-fg-muted">${t("Votre code : {code}", { code: `<span class="font-semibold text-fg">${code(r.code)}</span>` })}</p>
    <div class="mt-4">${alertBox(bonus > 0 ? "success" : "info", rule)}</div>`, "p-5");

  const st = r.stats || { referees: 0, firstWithdrawals: 0, bonus: 0 };
  const kpis = [
    kpi({ label: t("Filleuls"), value: kpiValue(fmt(st.referees)), sub: t("inscrits avec votre lien"), ic: "users" }),
    kpi({ label: t("Premiers retraits"), value: kpiValue(fmt(st.firstWithdrawals)), sub: st.referees ? t("sur {count}", { count: plural(st.referees, "filleul", "filleuls") }) : t("aucun filleul pour l'instant"), ic: "wallet" }),
    kpi({ label: t("Primes reçues"), value: bigMoney(st.bonus), sub: t("versées dans votre portefeuille"), ic: "gift" }),
  ];

  const row = (x) => `<li class="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      ${avatar({ id: x.name + x.joined, name: x.name }, "md")}
      <div class="min-w-0 flex-1"><p class="truncate text-sm font-medium text-fg">${esc(x.name)}</p>
        <p class="truncate text-xs tabular-nums text-fg-subtle">${t("Inscrit le {date}", { date: date(x.joined) })}${x.bonus ? ` · ${t("prime de {amount}", { amount: da(x.bonus) })}` : ""}</p></div>
      ${x.firstWithdrawal ? badge(t("Premier retrait effectué"), "success", { ic: "check" }) : badge(t("Inscrit"), "idle", { dot: true })}
    </li>`;
  const list = card(`${cardHeader(t("Vos filleuls"), r.referees.length ? t("Du plus récent au plus ancien.") : "")}
    ${r.referees.length ? `<ul class="mt-4 divide-y divide-line">${r.referees.map(row).join("")}</ul>`
      : emptyState("users", t("Aucun filleul pour l'instant"), t("Les clippers inscrits avec votre lien apparaîtront ici."), "", { inCard: true })}`, "p-5");

  const rules = [
    t("Votre filleul s'inscrit comme clipper avec votre lien, par email ou avec Google, Apple ou Discord."),
    t("Dès que son premier retrait est validé par l'équipe, vous recevez la prime : une seule fois par filleul."),
    t("Comme vos autres gains, la prime reste en rétention {days} avant d'être retirable.", { days: plural(hold, "jour", "jours") }),
    t("Pas de prime si votre filleul retire vers le même compte que vous, ou si votre compte est suspendu."),
  ];
  const rulesCard = card(`${cardHeader(t("Comment ça marche"))}<ul class="mt-3 grid gap-2.5">${rules.map((x) => `<li class="flex gap-2.5 text-small text-fg-muted">${icon("check", "mt-0.5 size-4 shrink-0 text-income")}<span>${x}</span></li>`).join("")}</ul>`, "p-5");

  return `${pageHeader(t("Parrainage"), t("Invitez d'autres clippers sur {brand} et recevez une prime à leur premier retrait."))}
    <div class="mt-6 grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-5">
      <div class="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4 lg:gap-5">${linkCard}
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">${kpis[0]}${kpis[1]}<div class="col-span-2 sm:col-span-1">${kpis[2]}</div></div>
        ${list}</div>
      <div class="grid content-start gap-4 lg:gap-5">${rulesCard}</div>
    </div>`;
}
