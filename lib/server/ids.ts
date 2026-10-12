import { randomBytes } from "node:crypto";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/** Identifiant aléatoire court (16 caractères, ~82 bits). */
export function newId(size = 16) {
  const bytes = randomBytes(size);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

/** Référence lisible pour une transaction, par exemple T-7K3F9Q. */
export const newRef = () => `T-${newId(6).toUpperCase()}`;
