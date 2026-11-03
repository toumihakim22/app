// Version autonome du site : l'accueil (rendu statique de `next build`), l'application et son API simulée
// dans le navigateur, réunis dans un seul fichier HTML qui s'ouvre sans serveur ni connexion internet.
// Appelé par `node web/build.mjs --offline`.
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, "..", "..");

const MIME = { ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf" };
const dataUri = (file) => `data:${MIME[extname(file).toLowerCase()] ?? "application/octet-stream"};base64,${readFileSync(file).toString("base64")}`;
const script = (code) => `<script>${code.replace(/<\/script/gi, "<\\/script")}</script>`;

/** Fichier local servi à l'adresse `path` : /_next/… depuis .next, le reste depuis public/. */
function localFile(path) {
  const clean = decodeURI(path.split(/[?#]/)[0]);
  const file = clean.startsWith("/_next/") ? join(root, ".next", clean.slice("/_next/".length)) : join(root, "public", clean);
  if (!existsSync(file)) throw new Error(`Fichier introuvable pour ${path} (${file})`);
  return file;
}

// Polices et images référencées par les feuilles de style : intégrées en data URI.
const inlineUrls = (css) => css.replace(/url\((["']?)(\/[^)"']+)\1\)/g, (_, q, path) => `url(${q}${dataUri(localFile(path))}${q})`);

function replaceOnce(html, search, value, what) {
  if (!(typeof search === "string" ? html.includes(search) : search.test(html))) throw new Error(`Gabarit web/index.html : ${what} introuvable`);
  return html.replace(search, () => value);
}

/** Page d'accueil : HTML statique de Next.js sans ses scripts React, et sa feuille de style. */
function landingPage() {
  const file = join(root, ".next", "server", "app", "index.html");
  if (!existsSync(file)) throw new Error("Page d'accueil introuvable (.next/server/app/index.html) : lancez d'abord `npx next build`.");
  const html = readFileSync(file, "utf8");
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1]
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<div hidden=""><\/div>/g, "")
    // Liens vers l'application et vers l'accueil : ancres de ce même fichier.
    .replace(/href="\/espace#\//g, 'href="#/')
    .replace(/href="\/espace"/g, 'href="#/connexion"')
    .replace(/href="\/"/g, 'href="#"')
    .replace(/src="(\/[^"]+)"/g, (_, path) => `src="${dataUri(localFile(path))}"`);
  const leftover = body.match(/href="\/[^"]*"/g);
  if (leftover) throw new Error(`Liens non convertis dans l'accueil : ${[...new Set(leftover)].join(", ")}`);
  const sheets = [...head.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(([, href]) => readFileSync(localFile(href), "utf8"));
  if (!sheets.length) throw new Error("Feuille de style de l'accueil introuvable dans .next/server/app/index.html");
  return {
    body,
    css: inlineUrls(sheets.join("\n")),
    title: head.match(/<title>([^<]*)<\/title>/)?.[1] ?? "ClipBoost",
    description: head.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "",
  };
}

/** API simulée (web/offline/server.ts) compilée pour le navigateur. */
async function apiBundle() {
  // lib/server/settings.ts n'est importé que pour DEFAULT_SETTINGS : sa connexion PostgreSQL est remplacée par un module vide.
  const withoutDb = {
    name: "sans-base",
    setup(b) {
      b.onResolve({ filter: /^\.\/db$/ }, (a) => (a.importer.endsWith(join("lib", "server", "settings.ts")) ? { path: "db", namespace: "sans-base" } : undefined));
      b.onLoad({ filter: /.*/, namespace: "sans-base" }, () => ({ contents: "export const getDb = () => { throw new Error('Base indisponible hors ligne'); };\nexport const schema = {};", loader: "js" }));
    },
  };
  // zod n'utilise que ses messages par défaut (anglais, comme sur le serveur) : les 40 autres langues sont écartées.
  const zodEnglishOnly = {
    name: "zod-en",
    setup(b) {
      b.onResolve({ filter: /\/locales\/index\.js$/ }, (a) => (a.importer.includes(`${sep}zod${sep}`) ? { path: join(dirname(a.importer), "..", "locales"), namespace: "zod-en" } : undefined));
      b.onLoad({ filter: /.*/, namespace: "zod-en" }, (a) => ({ contents: 'export { default as en } from "./en.js";', resolveDir: a.path, loader: "js" }));
    },
  };
  const result = await build({
    entryPoints: [join(dir, "server.ts")], bundle: true, write: false, format: "iife", platform: "browser", target: "es2020",
    minify: true, legalComments: "none", logLevel: "warning", plugins: [withoutDb, zodEnglishOnly],
  });
  return result.outputFiles[0].text;
}

// Avant l'affichage : l'accueil, ou l'application si l'adresse commence par #/, avec sa feuille de style.
const VIEW_INIT = `(function(){var h=location.hash,v=h.indexOf("#/")===0&&h!=="#/"?"app":"landing";document.documentElement.setAttribute("data-view",v);document.getElementById(v==="app"?"css-landing":"css-app").media="not all"})();`;

/**
 * Assemble le fichier autonome à partir du gabarit de l'application (web/index.html), de sa feuille de style
 * et de son JavaScript, déjà construits par web/build.mjs.
 */
export async function buildOffline({ template, css, js }) {
  const landing = landingPage();
  const api = await apiBundle();
  const landingJs = readFileSync(join(dir, "landing.js"), "utf8");
  // « Retour au site » : l'accueil de ce fichier, et non la racine du disque.
  const appJs = js.replace(/href="\/"/g, 'href="#"');
  const styles = [
    `<style id="css-landing">${landing.css}</style>`,
    `<style id="css-app">${inlineUrls(css)}</style>`,
    `<style>html[data-view=app] #landing,html[data-view=landing] #app{display:none!important}</style>`,
    script(VIEW_INIT),
  ].join("\n  ");
  let html = template;
  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${landing.title}</title>\n  <meta name="description" content="${landing.description}" />`, "<title>");
  html = replaceOnce(html, 'href="/favicon.svg"', `href="${dataUri(join(root, "public", "favicon.svg"))}"`, "favicon");
  html = replaceOnce(html, "<!--STYLES-->", styles, "<!--STYLES-->");
  html = replaceOnce(html, '<div id="app">', `<div id="landing">${landing.body}</div>\n  <div id="app">`, '<div id="app">');
  html = replaceOnce(html, "<!--SCRIPT-->", [api, landingJs, appJs].map(script).join("\n  "), "<!--SCRIPT-->");
  return html;
}
