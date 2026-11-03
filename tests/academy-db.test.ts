// Académie côté serveur, sur une base PGlite neuve dans un dossier temporaire : leçons de départ insérées par la
// migration 0011 (identiques à lib/server/academy-lessons.ts, que la version autonome utilise), leçons visibles selon le
// rôle, création, modification, ordre et suppression (services/academy.ts).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { asc } from "drizzle-orm";
import { getDb, schema } from "../lib/server/db";
import type { User } from "../lib/server/auth";
import { STARTER_LESSONS } from "../lib/server/academy-lessons";
import { academyState, createLesson, deleteLesson, moveLesson, updateLesson } from "../lib/server/services/academy";
import { lessonSchema } from "../lib/server/validation";

const dir = mkdtempSync(join(tmpdir(), "clipboost-academy-"));
process.env.PGLITE_DIR = join(dir, "db");
after(() => rmSync(dir, { recursive: true, force: true }));

const as = (role: User["role"]) => ({ id: role, role, name: "Équipe ClipBoost" }) as User;

test("migration 0011 : les leçons de départ, identiques à celles de la version autonome", async () => {
  const db = await getDb();
  const rows = await db.select().from(schema.lessons).orderBy(asc(schema.lessons.position));
  assert.deepEqual(rows.map(({ createdAt, updatedAt, ...l }) => l), STARTER_LESSONS);
  for (const l of STARTER_LESSONS) for (const f of ["title", "summary", "body"] as const) assert.ok(l[f].fr && l[f].en && l[f].ar, `${l.id}.${f}`);
});

test("services de l'Académie : visibilité selon le rôle, création, modification, ordre, suppression", async () => {
  const admin = as("admin"), input = lessonSchema.parse({ category: "Montage", emoji: "🎬", minutes: 5, videoUrl: "", title: { fr: "Brouillon", en: "" }, summary: { fr: "Résumé" }, body: { fr: "<b>Texte</b>" }, published: false });
  const id = await createLesson(admin, input);
  assert.equal((await academyState(as("clipper"))).length, 5);
  assert.deepEqual(await academyState(as("agence")), []);
  let all = await academyState(admin);
  assert.deepEqual([all.length, all[5].id, all[5].position, all[5].title, all[5].html.fr], [6, id, 6, { fr: "Brouillon" }, "<p>&lt;b&gt;Texte&lt;/b&gt;</p>"]);
  await updateLesson(admin, id, { ...input, published: true });
  assert.equal((await academyState(as("clipper"))).at(-1)!.id, id);
  await moveLesson(id, "up");
  await moveLesson("capcut-10-minutes", "up");
  all = await academyState(admin);
  assert.deepEqual(all.map((l) => l.position), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(all.slice(-2).map((l) => l.id), [id, "regles-campagne"]);
  await deleteLesson(admin, id);
  await assert.rejects(deleteLesson(admin, id), /Leçon introuvable/);
  await assert.rejects(moveLesson(id, "down"), /Leçon introuvable/);
  assert.equal((await academyState(admin)).length, 5);
  const log = (await (await getDb()).select().from(schema.activity)).map((a) => a.text);
  assert.ok(log.includes("Leçon « Brouillon » publiée dans l'Académie par Équipe ClipBoost."));
});
