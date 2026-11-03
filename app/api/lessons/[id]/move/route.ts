import { requireUser } from "@/lib/server/auth";
import { route, json, body } from "@/lib/server/http";
import { moveLesson } from "@/lib/server/services/academy";
import { lessonMoveSchema } from "@/lib/server/validation";

/** Académie : la leçon monte (up) ou descend (down) d'un cran dans l'ordre d'affichage. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  await requireUser("admin");
  const { direction } = await body(req, lessonMoveSchema);
  await moveLesson((await params).id, direction);
  return json({ ok: true });
});
