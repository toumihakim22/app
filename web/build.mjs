// Assemble l'application ClipBoost (connexion, inscription, espaces Clipper, Agence et Admin)
// en une seule page servie par Next.js à l'adresse /espace. Les données viennent de l'API (/api/*).
// Usage : node web/build.mjs [fichier-de-sortie]   (par défaut : public/espace.html)
//
// Avec --offline : tout le site (accueil, application et API simulée dans le navigateur) en un seul
// fichier HTML qui s'ouvre sans serveur, voir web/offline/build.mjs. Nécessite `next build` au préalable.
// Usage : node web/build.mjs --offline [fichier-de-sortie]   (par défaut : web/dist/clipboost-site.html)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const dir = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const offline = args.includes("--offline");
const outArg = args.find((a) => a !== "--offline");
const out = resolve(outArg ?? (offline ? join(dir, "dist", "clipboost-site.html") : join(dir, "..", "public", "espace.html")));

const cssPath = join(dir, "styles.css");
const { css: compiled } = await postcss([tailwind({ base: dir, optimize: true })]).process(readFileSync(cssPath, "utf8"), { from: cssPath });
// Polices : les url() Fontsource de app/theme.css deviennent des data: base64 (fichier autonome, aucune requête).
const fontDir = join(dir, "..", "node_modules", "@fontsource-variable");
const css = compiled.replace(/url\((["']?)[^)"']*@fontsource-variable\/([^/]+)\/files\/([^)"']+\.woff2)\1\)/g,
  (_, _q, pkg, file) => `url(data:font/woff2;base64,${readFileSync(join(fontDir, pkg, "files", file)).toString("base64")})`);
if ((css.match(/data:font\/woff2/g) || []).length !== 4) throw new Error("Polices non inlinées : lancez npm install.");

const parts = ["data.js", "ui.js", "auth.js", "clipper.js", "admin.js", "agency.js", "main.js"].map((f) => readFileSync(join(dir, "src", f), "utf8"));
const js = `${readFileSync(join(dir, "theme.js"), "utf8")}\n(function () {\n"use strict";\n${parts.join("\n")}\n})();`;

const template = readFileSync(join(dir, "index.html"), "utf8");
const html = offline
  ? await (await import("./offline/build.mjs")).buildOffline({ template, css, js })
  : template
    .replace("<!--STYLES-->", () => `<style>${css}</style>`)
    .replace("<!--SCRIPT-->", () => `<script>${js.replace(/<\/script/gi, "<\\/script")}</script>`);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`${out} (${(html.length / 1024).toFixed(0)} Ko)`);
