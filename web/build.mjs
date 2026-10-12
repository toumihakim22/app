// Assemble l'application ClipBoost (connexion, inscription, espaces Clipper, Agence et Admin)
// en une seule page servie par Next.js à l'adresse /espace. Les données viennent de l'API (/api/*).
// Usage : node web/build.mjs [fichier-de-sortie]   (par défaut : public/espace.html)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const dir = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.argv[2] ?? join(dir, "..", "public", "espace.html"));

const cssPath = join(dir, "styles.css");
const { css } = await postcss([tailwind({ base: dir, optimize: true })]).process(readFileSync(cssPath, "utf8"), { from: cssPath });

const parts = ["data.js", "ui.js", "auth.js", "clipper.js", "admin.js", "agency.js", "main.js"].map((f) => readFileSync(join(dir, "src", f), "utf8"));
const js = `${readFileSync(join(dir, "theme.js"), "utf8")}\n(function () {\n"use strict";\n${parts.join("\n")}\n})();`;

const html = readFileSync(join(dir, "index.html"), "utf8")
  .replace("<!--STYLES-->", () => `<style>${css}</style>`)
  .replace("<!--SCRIPT-->", () => `<script>${js.replace(/<\/script/gi, "<\\/script")}</script>`);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`${out} (${(html.length / 1024).toFixed(0)} Ko)`);
