// Assemble tout le site ClipBoost (accueil, inscription/connexion, espace Clipper, administration)
// en un seul fichier HTML autonome, à ouvrir directement dans un navigateur.
// Prérequis : `npm run build` (la page d'accueil est reprise du rendu Next.js).
// Usage : node standalone/build.mjs [fichier-de-sortie]
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const dir = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.argv[2] ?? join(dir, "dist", "clipboost-site.html"));
const nextHtml = join(dir, "..", ".next", "server", "app", "index.html");
if (!existsSync(nextHtml)) {
  console.error("Page d'accueil introuvable : lancez d'abord `npm run build`.");
  process.exit(1);
}

// Page d'accueil : HTML statique produit par Next.js, sans ses scripts React.
const landing = readFileSync(nextHtml, "utf8")
  .match(/<body[^>]*>([\s\S]*)<\/body>/)[1]
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "")
  .replace(/<!--\$-->|<!--\/\$-->|<!-- -->/g, "");

const cssPath = join(dir, "styles.css");
const { css } = await postcss([tailwind({ base: dir, optimize: true })]).process(readFileSync(cssPath, "utf8"), { from: cssPath });

const parts = ["data.js", "ui.js", "auth.js", "clipper.js", "admin.js", "agency.js", "main.js"].map((f) => readFileSync(join(dir, "src", f), "utf8"));
const js = `${readFileSync(join(dir, "landing.js"), "utf8")}\n(function () {\n"use strict";\n${parts.join("\n")}\n})();`;

const html = readFileSync(join(dir, "index.html"), "utf8")
  .replace("<!--STYLES-->", () => `<style>${css}</style>`)
  .replace("<!--LANDING-->", () => landing)
  .replace("<!--SCRIPT-->", () => `<script>${js.replace(/<\/script/gi, "<\\/script")}</script>`);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`${out} (${(html.length / 1024).toFixed(0)} Ko)`);
