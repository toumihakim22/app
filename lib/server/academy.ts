// Académie (tutoriels courts des clippers) : règles pures partagées par le serveur (services/academy.ts) et la version
// autonome (web/offline/academy.ts) : texte dans la langue demandée avec retour au français, corps des leçons mis en
// HTML échappé, ordre des leçons, textes du journal d'activité (en français, traduits par l'interface).
import type { LessonText } from "./db/schema";

export const LESSON_LANGS = ["fr", "en", "ar"] as const;
export type LessonLang = (typeof LESSON_LANGS)[number];
/** Catégories proposées dans l'éditeur (une catégorie libre est aussi acceptée). */
export const LESSON_CATEGORIES = ["Montage", "Accroche", "Formats"];

/** Texte dans la langue demandée, ou en français quand il n'est pas traduit (vide compris). */
export function lessonText(value: LessonText, lang: LessonLang) {
  const v = lang === "fr" ? "" : value[lang]?.trim();
  return v ? value[lang]! : value.fr;
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

const BULLET = /^\s*[-–•]\s+(.*)$/;
const STEP = /^\s*(\d{1,3})[.)]\s+(.*)$/;

/**
 * Corps d'une leçon (texte simple) en HTML sûr : une ligne vide sépare les paragraphes (<p>, retours à la ligne en <br>),
 * les lignes qui commencent par « - » forment une liste à puces (<ul>), celles qui commencent par « 1. » (ou « 1) »)
 * des étapes numérotées (<ol>, qui démarre au premier numéro écrit). Tout le texte est échappé : aucune balise, aucun
 * attribut ni lien ne passe tel quel. Seules sortent les balises p, br, ul, ol, li (et l'attribut start, numérique).
 */
export function lessonBodyHtml(body: string) {
  const out: string[] = [];
  let kind: "p" | "ul" | "ol" | null = null, items: string[] = [], start = 1;
  const close = () => {
    if (kind === "p") out.push(`<p>${items.join("<br>")}</p>`);
    else if (kind) out.push(`<${kind}${kind === "ol" && start !== 1 ? ` start="${start}"` : ""}>${items.map((x) => `<li>${x}</li>`).join("")}</${kind}>`);
    kind = null; items = [];
  };
  for (const line of String(body ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    if (!line.trim()) { close(); continue; }
    const bullet = BULLET.exec(line), step = bullet ? null : STEP.exec(line);
    const next = bullet ? "ul" : step ? "ol" : "p";
    if (next !== kind) {
      close();
      kind = next;
      if (step) start = Number(step[1]);
    }
    items.push(escapeHtml((bullet ? bullet[1] : step ? step[2] : line).trim()));
  }
  close();
  return out.join("");
}

/** HTML du corps dans chaque langue écrite (français toujours ; anglais et arabe s'ils sont traduits). */
export function lessonHtml(body: LessonText) {
  const html: Partial<Record<LessonLang, string>> = { fr: lessonBodyHtml(body.fr) };
  for (const l of ["en", "ar"] as const) if (body[l]?.trim()) html[l] = lessonBodyHtml(body[l]!);
  return html as { fr: string; en?: string; ar?: string };
}

/** Leçon telle que l'enregistrent la base et la version autonome (dates en millisecondes ou en Date). */
export type LessonLike = {
  id: string; category: string; emoji: string; minutes: number; videoUrl: string | null;
  title: LessonText; summary: LessonText; body: LessonText; position: number; published: boolean;
  createdAt: Date | number; updatedAt: Date | number;
};

/** Ordre d'affichage : position croissante, puis date de création, puis identifiant (ordre stable). */
export function sortLessons<T extends LessonLike>(list: T[]) {
  const ms = (d: Date | number) => (typeof d === "number" ? d : d.getTime());
  return [...list].sort((a, b) => a.position - b.position || ms(a.createdAt) - ms(b.createdAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Leçon envoyée à l'interface (GET /api/state) : textes dans les trois langues (l'interface choisit, avec retour au
 * français), corps en HTML sûr (html). L'admin reçoit aussi le corps brut (body), pour l'éditeur.
 */
export function lessonView(l: LessonLike, admin: boolean) {
  const iso = (d: Date | number) => new Date(d).toISOString();
  return {
    id: l.id, category: l.category, emoji: l.emoji, minutes: l.minutes, videoUrl: l.videoUrl, title: l.title, summary: l.summary,
    html: lessonHtml(l.body), position: l.position, published: l.published, updatedAt: iso(l.updatedAt),
    ...(admin ? { body: l.body, createdAt: iso(l.createdAt) } : {}),
  };
}

/**
 * Nouvel ordre après « monter » ou « descendre » une leçon (list : toutes les leçons, dans l'ordre d'affichage) :
 * les identifiants dans le nouvel ordre, ou null si la leçon est déjà en tête (up) ou en dernier (down).
 */
export function movedOrder(list: { id: string }[], id: string, direction: "up" | "down") {
  const ids = list.map((l) => l.id), i = ids.indexOf(id), j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return null;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  return ids;
}

// Journal d'activité (textes français, traduits par web/src/i18n/{en,ar}/server.js).
export const lessonCreatedText = (title: string, by: string, published: boolean) =>
  published ? `Leçon « ${title} » ajoutée à l'Académie par ${by}.` : `Leçon « ${title} » ajoutée en brouillon par ${by}.`;
export const lessonUpdatedText = (title: string, by: string, before: boolean, after: boolean) =>
  before === after ? `Leçon « ${title} » modifiée par ${by}.`
    : after ? `Leçon « ${title} » publiée dans l'Académie par ${by}.` : `Leçon « ${title} » retirée de l'Académie (brouillon) par ${by}.`;
export const lessonDeletedText = (title: string, by: string) => `Leçon « ${title} » supprimée par ${by}.`;
