// Académie : tutoriels courts des clippers (montage, accroche, formats…), gérés par l'équipe. Les clippers voient les
// leçons publiées, l'admin toutes (brouillons compris) ; l'admin les crée, les modifie, les publie ou les masque, les
// range (monter, descendre) et les supprime. Règles pures et textes : lib/server/academy.ts.
import { asc, eq, max } from "drizzle-orm";
import { getDb, schema } from "../db";
import type { User } from "../auth";
import { logActivity } from "../events";
import { notFound } from "../http";
import { newId } from "../ids";
import { lessonCreatedText, lessonDeletedText, lessonUpdatedText, lessonView, movedOrder, sortLessons } from "../academy";
import type { LessonInput } from "../validation";

const L = schema.lessons;

/** Leçons de GET /api/state : publiées pour un clipper, toutes pour l'admin, aucune pour une agence. */
export async function academyState(user: User) {
  if (user.role === "agence") return [];
  const db = await getDb(), admin = user.role === "admin";
  const rows = await (admin ? db.select().from(L) : db.select().from(L).where(eq(L.published, true)));
  return sortLessons(rows).map((l) => lessonView(l, admin));
}

const fields = (input: LessonInput) => ({
  category: input.category, emoji: input.emoji, minutes: input.minutes, videoUrl: input.videoUrl,
  title: input.title, summary: input.summary, body: input.body, published: input.published,
});

/** Nouvelle leçon, rangée en dernier. */
export async function createLesson(admin: User, input: LessonInput) {
  const db = await getDb(), id = newId();
  await db.transaction(async (tx) => {
    const [{ last }] = await tx.select({ last: max(L.position) }).from(L);
    await tx.insert(L).values({ id, ...fields(input), position: (last ?? 0) + 1 });
    await logActivity(tx, "🎓", lessonCreatedText(input.title.fr, admin.name, input.published));
  });
  return id;
}

/** Modification complète d'une leçon (textes, réglages, publication) ; sa place ne change pas. */
export async function updateLesson(admin: User, id: string, input: LessonInput) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(L).where(eq(L.id, id)).for("update");
    if (!row) throw notFound("Leçon introuvable");
    await tx.update(L).set({ ...fields(input), updatedAt: new Date() }).where(eq(L.id, id));
    await logActivity(tx, "🎓", lessonUpdatedText(input.title.fr, admin.name, row.published, input.published));
  });
}

export async function deleteLesson(admin: User, id: string) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [row] = await tx.delete(L).where(eq(L.id, id)).returning();
    if (!row) throw notFound("Leçon introuvable");
    await logActivity(tx, "🎓", lessonDeletedText(row.title.fr, admin.name));
  });
}

/**
 * Monte ou descend une leçon d'un cran : les leçons sont relues (et verrouillées) dans l'ordre d'affichage, puis
 * renumérotées de 1 à n dans le nouvel ordre. Déjà en tête (ou en dernier) : rien ne change.
 */
export async function moveLesson(id: string, direction: "up" | "down") {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const rows = sortLessons(await tx.select().from(L).orderBy(asc(L.position)).for("update"));
    if (!rows.some((l) => l.id === id)) throw notFound("Leçon introuvable");
    const order = movedOrder(rows, id, direction);
    if (!order) return;
    const at = new Map(rows.map((l) => [l.id, l.position]));
    for (const [i, lessonId] of order.entries()) if (at.get(lessonId) !== i + 1) await tx.update(L).set({ position: i + 1 }).where(eq(L.id, lessonId));
  });
}
