import { requireUser } from "@/lib/server/auth";
import { route, json, body } from "@/lib/server/http";
import { deleteLesson, updateLesson } from "@/lib/server/services/academy";
import { lessonSchema } from "@/lib/server/validation";

type Ctx = { params: Promise<{ id: string }> };

/** Académie : modification d'une leçon (textes en français, anglais et arabe, réglages, publication). */
export const PUT = route<Ctx>(async (req, { params }) => {
  const admin = await requireUser("admin");
  await updateLesson(admin, (await params).id, await body(req, lessonSchema));
  return json({ ok: true });
});

/** Académie : suppression définitive d'une leçon. */
export const DELETE = route<Ctx>(async (_req, { params }) => {
  const admin = await requireUser("admin");
  await deleteLesson(admin, (await params).id);
  return json({ ok: true });
});
