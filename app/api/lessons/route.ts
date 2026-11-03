import { requireUser } from "@/lib/server/auth";
import { route, json, body } from "@/lib/server/http";
import { createLesson } from "@/lib/server/services/academy";
import { lessonSchema } from "@/lib/server/validation";

/** Académie : nouvelle leçon écrite par l'équipe (rangée en dernier). */
export const POST = route(async (req) => {
  const admin = await requireUser("admin");
  const id = await createLesson(admin, await body(req, lessonSchema));
  return json({ ok: true, id }, { status: 201 });
});
