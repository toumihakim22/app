// Assemble l'espace Clipper en un seul fichier HTML autonome.
// Usage : node standalone/clipper/build.mjs [fichier-de-sortie]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const dir = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.argv[2] ?? join(dir, "dist", "clipboost-clipper.html"));

const cssPath = join(dir, "styles.css");
const { css } = await postcss([tailwind({ base: dir, optimize: true })]).process(readFileSync(cssPath, "utf8"), { from: cssPath });
const js = readFileSync(join(dir, "app.js"), "utf8");
const html = readFileSync(join(dir, "index.html"), "utf8")
  .replace("<!--STYLES-->", () => `<style>${css}</style>`)
  .replace("<!--SCRIPT-->", () => `<script>${js.replace(/<\/script/gi, "<\\/script")}</script>`);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`${out} (${(html.length / 1024).toFixed(0)} Ko)`);
