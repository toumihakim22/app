// Académie, version autonome : la copie de lib/server/services/academy.ts (mêmes règles, mêmes textes, mêmes effets).
// Les leçons de départ sont posées par seed.ts et, pour une base d'avant l'Académie, par upgrade() (db.ts).
import { lessonCreatedText, lessonDeletedText, lessonUpdatedText, lessonView, movedOrder, sortLessons } from "../../lib/server/academy";
import type { LessonInput } from "../../lib/server/validation";
import { logActivity, newId, notFound, type Store, type UserRow } from "./db";

/** Leçons de GET /api/state : publiées pour un clipper, toutes pour l'admin, aucune pour une agence. */
export function academyState(db: Store, user: UserRow) {
  if (user.role === "agence") return [];
  const admin = user.role === "admin";
  return sortLessons(admin ? db.lessons : db.lessons.filter((l) => l.published)).map((l) => lessonView(l, admin));
}

const fields = (input: LessonInput) => ({
  category: input.category, emoji: input.emoji, minutes: input.minutes, videoUrl: input.videoUrl,
  title: input.title, summary: input.summary, body: input.body, published: input.published,
});

/** Nouvelle leçon, rangée en dernier. */
export function createLesson(db: Store, admin: UserRow, input: LessonInput) {
  const id = newId(), now = Date.now();
  const last = db.lessons.reduce((m, l) => Math.max(m, l.position), 0);
  db.lessons.push({ id, ...fields(input), position: last + 1, createdAt: now, updatedAt: now });
  logActivity(db, "🎓", lessonCreatedText(input.title.fr, admin.name, input.published));
  return id;
}

/** Modification complète d'une leçon (textes, réglages, publication) ; sa place ne change pas. */
export function updateLesson(db: Store, admin: UserRow, id: string, input: LessonInput) {
  const row = db.lessons.find((l) => l.id === id);
  if (!row) throw notFound("Leçon introuvable");
  const before = row.published;
  Object.assign(row, fields(input), { updatedAt: Date.now() });
  logActivity(db, "🎓", lessonUpdatedText(input.title.fr, admin.name, before, input.published));
}

export function deleteLesson(db: Store, admin: UserRow, id: string) {
  const row = db.lessons.find((l) => l.id === id);
  if (!row) throw notFound("Leçon introuvable");
  db.lessons = db.lessons.filter((l) => l.id !== id);
  logActivity(db, "🎓", lessonDeletedText(row.title.fr, admin.name));
}

/** Monte ou descend une leçon d'un cran, puis renumérote les leçons de 1 à n ; déjà en tête (ou en dernier) : rien. */
export function moveLesson(db: Store, id: string, direction: "up" | "down") {
  const rows = sortLessons(db.lessons);
  if (!rows.some((l) => l.id === id)) throw notFound("Leçon introuvable");
  const order = movedOrder(rows, id, direction);
  if (!order) return;
  for (const [i, lessonId] of order.entries()) db.lessons.find((l) => l.id === lessonId)!.position = i + 1;
}
