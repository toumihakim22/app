// Réglages de l'outil de contrôle du code (`npm run lint`).
// - Partie Next.js (app/, components/, lib/, data/) : règles recommandées par Next.js, avec TypeScript.
// - Application /espace (web/src/*.js) : fichiers JavaScript du navigateur que web/build.mjs colle bout à bout
//   dans une seule fonction. Une fonction écrite dans ui.js est donc utilisée dans web/src/admin/ sans import :
//   les règles « variable inconnue » et « variable inutilisée » ne peuvent pas juger fichier par fichier et sont coupées.
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import globals from "globals";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  {
    ignores: ["node_modules/**", ".next/**", "out/**", ".data/**", "public/espace.html", "web/dist/**", "next-env.d.ts", "drizzle/**"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Retirer des champs d'un objet avec « const { a, ...reste } = objet » est voulu : « a » n'a pas à être utilisé.
    rules: { "@typescript-eslint/no-unused-vars": ["warn", { ignoreRestSiblings: true }] },
  },
  {
    files: ["web/src/**/*.js", "web/theme.js"],
    languageOptions: { sourceType: "script", globals: { ...globals.browser } },
    rules: { "no-undef": "off", "no-unused-vars": "off", "@typescript-eslint/no-unused-vars": "off" },
  },
  {
    files: ["**/*.mjs", "**/*.mts", "scripts/**", "tests/**"],
    languageOptions: { globals: { ...globals.node } },
  },
];

export default config;
