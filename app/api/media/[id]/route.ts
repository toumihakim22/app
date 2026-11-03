import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/server/db";
import { notFound, route } from "@/lib/server/http";

// Image envoyée par un utilisateur (photo de profil, couverture, photo de campagne), publique comme les pages qui l'affichent.
// Une image n'est jamais modifiée (une nouvelle image a une nouvelle adresse) : elle peut rester en cache indéfiniment.
export const GET = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const { id } = await params;
  if (!/^[a-z0-9]{16}$/.test(id)) throw notFound("Image introuvable");
  const db = await getDb();
  const [m] = await db.select({ mime: schema.media.mime, data: schema.media.data }).from(schema.media).where(eq(schema.media.id, id));
  if (!m) throw notFound("Image introuvable");
  const bytes = new Uint8Array(Buffer.from(m.data, "base64"));
  return new Response(bytes, {
    headers: {
      "Content-Type": m.mime,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
});
