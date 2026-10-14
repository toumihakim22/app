// Images envoyées par les utilisateurs (photo de profil, couverture d'agence, photo de campagne).
// L'interface les recadre et les compresse dans le navigateur, puis les envoie en data URL ; le serveur
// les range dans la table media et enregistre leur adresse « /api/media/<id> » (servie par app/api/media/[id]).
import { and, eq } from "drizzle-orm";
import { schema } from "./db";
import type { Tx } from "./events";
import { badRequest } from "./http";
import { newId } from "./ids";
import { IMAGE_DATA_URL, MEDIA_URL } from "./validation";

/** Taille maximale d'une image une fois décodée : 1,5 Mo (voir MAX_IMAGE_CHARS). */
export const MAX_IMAGE_BYTES = 1_500_000;

// Signature des formats acceptés : le contenu doit correspondre au type annoncé par la data URL.
const MAGIC: Record<string, (b: Buffer) => boolean> = {
  jpeg: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  png: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  webp: (b) => b.length > 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP",
};

/** Identifiant de l'image si `url` est une adresse « /api/media/<id> », sinon null. */
export const mediaId = (url: string | null | undefined) => (url && MEDIA_URL.test(url) ? url.slice("/api/media/".length) : null);

/** Supprime l'image enregistrée à cette adresse, si elle appartient à `ownerId` (sans effet sinon). */
export async function deleteMedia(db: Tx, ownerId: string, url: string | null | undefined) {
  const id = mediaId(url);
  if (id) await db.delete(schema.media).where(and(eq(schema.media.id, id), eq(schema.media.ownerId, ownerId)));
}

/**
 * Nouvelle valeur d'un champ image (`current` : sa valeur actuelle), à enregistrer dans la colonne :
 * - undefined : champ absent de la requête, image inchangée ;
 * - "" ou null : image retirée (l'ancienne est supprimée) ;
 * - la valeur actuelle : inchangée ;
 * - data URL JPEG, PNG ou WebP : nouvelle image, contrôlée (taille, signature) et rangée dans la table media ;
 *   l'ancienne image du champ est supprimée ;
 * - toute autre adresse (l'image d'un autre champ ou d'un autre compte) : refusée.
 * À appeler dans la même transaction que la mise à jour de la colonne, pour ne jamais laisser d'image orpheline.
 */
export async function storeImage(db: Tx, ownerId: string, value: string | null | undefined, current: string | null): Promise<string | null> {
  if (value === undefined || value === current) return current;
  if (value === "" || value === null) {
    await deleteMedia(db, ownerId, current);
    return null;
  }
  const m = IMAGE_DATA_URL.exec(value);
  if (!m) throw badRequest("Image invalide");
  const type = m[1];
  const base64 = value.slice(value.indexOf(",") + 1);
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length > MAX_IMAGE_BYTES) throw badRequest("Image trop lourde (1,5 Mo maximum)");
  if (!MAGIC[type]?.(bytes)) throw badRequest("Image invalide (JPEG, PNG ou WebP)");
  const id = newId();
  // Contenu ré-encodé depuis les octets décodés : base64 canonique, sans caractère inattendu.
  await db.insert(schema.media).values({ id, ownerId, mime: `image/${type}`, data: bytes.toString("base64") });
  await deleteMedia(db, ownerId, current);
  return `/api/media/${id}`;
}
