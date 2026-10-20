// Données d'exemple uniquement : conversations de campagne (questions des clippers, réponses de l'agence ou de l'équipe),
// avec les notifications envoyées à chaque message (mêmes textes que les services, lib/server/rules.ts). Partagées par
// scripts/seed.mts et la version autonome (web/offline/seed.ts).
import { link } from "./links";
import { clipperMessageText, replyText } from "./rules";

type Person = { id: string; name: string };
type Camp = { id: string; title: string };

/** to « admins » : chaque administrateur (campagne de ClipBoost). read : notification déjà lue. */
export type DemoNote = { to: string | "admins"; days: number; text: string; link: string; read: boolean };
export type DemoMessage = { campaignId: string; clipperId: string; senderId: string; body: string; days: number; read: boolean };

/**
 * Quatre conversations : Yacine sur le derby (réponse de Tassili Sport pas encore lue), Amira sur le derby (en attente de
 * l'agence), Lina sur « Les Sketchs du Bled » (en attente de l'équipe), Yacine sur « Kahwa du matin » (répondue, lue).
 */
export function demoThreads(p: { yacine: Person; amira: Person; lina: Person; tassili: Person; admin: Person; derby: Camp; kahwa: Camp; rire: Camp }) {
  const messages: DemoMessage[] = [], notes: DemoNote[] = [];
  const ask = (u: Person, c: Camp, owner: Person | null, body: string, days: number, read: boolean, question = true) => {
    messages.push({ campaignId: c.id, clipperId: u.id, senderId: u.id, body, days, read });
    const text = clipperMessageText(u.name, c.title, body, question);
    notes.push(owner ? { to: owner.id, days, text, link: link.agencyThread(c.id, u.id), read } : { to: "admins", days, text, link: link.adminThread(c.id, u.id), read });
  };
  const answer = (u: Person, c: Camp, from: Person, agency: string | null, body: string, days: number, read: boolean) => {
    messages.push({ campaignId: c.id, clipperId: u.id, senderId: from.id, body, days, read });
    notes.push({ to: u.id, days, text: replyText(agency, c.title, body), link: link.clipperThread(c.id), read });
  };
  const { yacine, amira, lina, tassili, admin, derby, kahwa, rire } = p;
  ask(yacine, kahwa, null, "Bonjour, faut-il montrer le logo Kahwa Lounge à l'écran ou suffit-il de citer le nom dans la vidéo ?", 5, true);
  answer(yacine, kahwa, admin, null, "Bonjour Yacine, montrez le gobelet avec le logo dans les 3 premières secondes : c'est la règle principale. Citer le nom en plus est un bonus.", 4.8, true);
  ask(yacine, derby, tassili, "Bonjour ! Est-ce que je peux utiliser les images du match diffusées à la télé, ou seulement mes propres vidéos filmées depuis les tribunes ?", 1.3, true);
  answer(yacine, derby, tassili, tassili.name, "Bonjour Yacine, les extraits de la diffusion TV sont acceptés s'ils durent moins de 10 secondes. Vos images des tribunes sont encore mieux : elles marchent très bien !", 1.1, false);
  ask(lina, rire, null, "Bonjour, mon sketch dure 75 secondes : faut-il le couper pour YouTube Shorts, ou puis-je le publier en vidéo classique ?", 0.3, false);
  ask(amira, derby, tassili, "Salut ! La campagne accepte-t-elle les clips au format carré sur Instagram, ou seulement le format vertical ?", 0.15, false);
  return { messages, notes };
}
