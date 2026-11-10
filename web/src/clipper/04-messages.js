// Espace Clipper (4/9) : messages par campagne.
// Les fichiers de web/src/clipper/ sont collés dans l'ordre de leur numéro par web/build.mjs (même portée).

// ---------- Messages : une conversation par campagne (#/clipper/messages/<campagne>) ----------
// Le clipper pose sa question depuis la fiche d'une campagne (« Poser une question ») ; l'agence, ou l'équipe ClipBoost
// pour une campagne de ClipBoost, répond. Une campagne active ou en pause accepte de nouveaux messages.
const clThreadOf = (campaignId) => msgThreads().find((x) => x.campaignId === campaignId) || null;
const clAskable = (c) => c.status === "Active" || c.status === "En pause";
const clAnswerer = (c) => (c.ownerId ? clOrgName(c) : t("l'équipe {brand}"));

function cMessages() {
  const id = state.route.item || "", threads = msgThreads().filter((x) => campaignById(x.campaignId));
  const list = threads.length
    ? threads.map((x) => { const c = campaignById(x.campaignId); return msgThreadItem({ href: `#/clipper/messages/${encodeURIComponent(c.id)}`, current: c.id === id, thumb: coverThumb(c), title: esc(c.title), sub: esc(clOrgName(c)), thread: msgMine(x, true) }); }).join("")
    : emptyState("message", t("Aucune conversation"), t("Une question sur une campagne ? Ouvrez sa fiche et choisissez « Poser une question »."), `<a href="#/clipper/decouvrir" class="${btn("secondary")}">${t("Découvrir les campagnes")}</a>`, { inCard: true });
  let conversation = "";
  if (id) {
    const c = campaignById(id), x = c && clThreadOf(c.id);
    if (!c) conversation = `<div class="grid flex-1 place-items-center">${emptyState("message", t("Conversation introuvable"), t("Cette campagne n'est plus visible."), `<a href="#/clipper/messages" class="${btn("secondary")}">${t("Voir mes conversations")}</a>`, { inCard: true })}</div>`;
    else {
      msgAutoRead(x, { campaignId: c.id });
      const o = clOrgOf(c), who = clAnswerer(c);
      conversation = msgConversation({
        back: "#/clipper/messages",
        head: `${coverThumb(c)}<div class="min-w-0"><p class="truncate text-sm font-semibold text-fg">${esc(c.title)}</p><p class="truncate text-xs text-fg-subtle">${c.ownerId ? `${esc(o.name)}${o.verified ? `${NB}${verifiedBadge("size-3.5")}` : ""}` : t("Réponses de l'équipe {brand}")}</p></div>`,
        actions: `<button type="button" data-action="open-campaign" data-id="${c.id}" class="${btn("secondary", "sm", "shrink-0")}">${icon("info", "size-4")}<span class="max-sm:hidden">${t("Voir la campagne")}</span></button>`,
        messages: x ? msgMine(x, true).messages : [],
        empty: `<div class="grid h-full place-items-center">${emptyState("message", t("Posez votre question"), t("{name} vous répondra ici. Vous serez prévenu par une notification.", { name: esc(who) }), "", { inCard: true })}</div>`,
        composer: msgComposer("cl-msg", t("Écrivez votre question…"), clAskable(c) ? "" : t("Cette campagne est terminée : vous ne pouvez plus envoyer de message.")),
      });
    }
  }
  return msgLayout({ title: t("Messages"), text: t("Vos questions aux agences sur leurs campagnes, et leurs réponses."), list, conversation });
}
