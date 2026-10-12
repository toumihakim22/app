import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// Hachage des mots de passe avec scrypt (inclus dans Node, aucune dépendance).
const PARAMS: ScryptOptions = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 64;

function derive(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => scrypt(password, salt, KEYLEN, PARAMS, (err, key) => (err ? reject(err) : resolve(key))));
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const key = await derive(password, Buffer.from(salt, "base64"));
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Au moins 8 caractères, avec une lettre et un chiffre. */
export const strongEnough = (password: string) => password.length >= 8 && /[a-zA-Z]/.test(password) && /\d/.test(password);
