// Petit générateur de PDF sans dépendance, isomorphe (Uint8Array et TextEncoder seulement) : il sert au serveur et à la
// version autonome (web/offline/). Polices standard du lecteur PDF (Helvetica, Helvetica-Bold : rien à embarquer),
// encodage WinAnsi (cp1252), format A4, en points (1/72 de pouce), origine en bas à gauche. Texte, traits et rectangles
// pleins : de quoi composer une facture ou un reçu (lib/server/documents.ts).

export const A4 = { width: 595.28, height: 841.89 };

export type Rgb = [number, number, number];
export type FontName = "regular" | "bold";

/** Couleur « #7c3aed » → composantes de 0 à 1. */
export const hex = (h: string): Rgb => [0, 2, 4].map((i) => parseInt(h.replace("#", "").slice(i, i + 2), 16) / 255) as Rgb;

// Largeurs des glyphes (millièmes de la taille du corps) des codes WinAnsi 32 à 255 : métriques AFM d'Adobe.
const W_REGULAR = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, 350, 556, 350, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 350, 611, 350, 350, 222, 222, 333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, 350, 500, 667, 278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333, 400, 584, 333, 333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611, 667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, 556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278, 556, 556, 556, 556, 556, 556, 556, 584, 611, 556, 556, 556, 556, 500, 556, 500];
const W_BOLD = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584, 350, 556, 350, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, 350, 611, 350, 350, 278, 278, 500, 500, 350, 556, 1000, 333, 1000, 556, 333, 944, 350, 500, 667, 278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 333, 400, 584, 333, 333, 333, 611, 556, 278, 333, 333, 365, 556, 834, 834, 834, 611, 722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, 556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278, 611, 611, 611, 611, 611, 611, 611, 584, 611, 611, 611, 611, 611, 556, 611, 556];

// Caractères de cp1252 entre 0x80 et 0x9f (les autres codes de 0xa0 à 0xff sont ceux de Latin-1).
const CP1252: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88, "‰": 0x89, "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e,
  "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f,
};
// Équivalents des caractères absents de cp1252 : espaces insécables et fines (séparateur des milliers en français),
// tirets et guillemets typographiques, flèches.
const FALLBACK: Record<string, string> = { " ": " ", " ": " ", " ": " ", " ": " ", "‑": "-", "−": "-", "→": "->", "←": "<-", "′": "'", "″": "\"" };

/** Texte → octets WinAnsi : un caractère inconnu perd son accent (« ő » → « o »), sinon devient « ? ». */
export function winAnsi(text: string): number[] {
  const out: number[] = [];
  for (const ch of text.normalize("NFC")) {
    const c = ch.codePointAt(0)!;
    if (FALLBACK[ch] !== undefined) {
      for (const f of FALLBACK[ch]) out.push(f.charCodeAt(0));
    } else if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa1 && c <= 0xff)) out.push(c);
    else if (CP1252[ch] !== undefined) out.push(CP1252[ch]);
    else if (c === 0x09 || c === 0x0a || c === 0x0d) out.push(0x20);
    else {
      const bare = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
      const b = bare.codePointAt(0) ?? 0;
      out.push(bare.length === 1 && b >= 0x20 && b <= 0x7e ? b : 0x3f);
    }
  }
  return out;
}

/** Largeur d'un texte en points (police et taille données). */
export function textWidth(text: string, size: number, font: FontName = "regular") {
  const w = font === "bold" ? W_BOLD : W_REGULAR;
  return (winAnsi(text).reduce((s, b) => s + (w[b - 32] ?? 556), 0) * size) / 1000;
}

/** Texte coupé en lignes d'au plus `max` points (aux espaces ; un mot trop long reste entier). */
export function wrapText(text: string, size: number, max: number, font: FontName = "regular"): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && textWidth(next, size, font) > max) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

const num = (n: number) => (Math.round(n * 100) / 100).toString();
const color = ([r, g, b]: Rgb) => `${num(r)} ${num(g)} ${num(b)}`;
const hexString = (bytes: number[]) => `<${bytes.map((b) => b.toString(16).padStart(2, "0")).join("")}>`;

export type TextOptions = { size?: number; font?: FontName; color?: Rgb; align?: "left" | "right" | "center" };

/** Une page : ses instructions de dessin (flux de contenu PDF), en coordonnées du bas à gauche. */
export class PdfPage {
  readonly ops: string[] = [];
  constructor(readonly width = A4.width, readonly height = A4.height) {}

  /** Texte d'une ligne ; `x` est le bord gauche, le bord droit (align « right ») ou le centre, `y` la ligne de base. */
  text(x: number, y: number, text: string, { size = 10, font = "regular", color: c = [0, 0, 0], align = "left" }: TextOptions = {}) {
    if (!text) return this;
    const w = align === "left" ? 0 : textWidth(text, size, font);
    const left = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
    this.ops.push(`BT /${font === "bold" ? "F2" : "F1"} ${num(size)} Tf ${color(c)} rg ${num(left)} ${num(y)} Td ${hexString(winAnsi(text))} Tj ET`);
    return this;
  }

  /** Trait de (x1, y1) à (x2, y2). */
  line(x1: number, y1: number, x2: number, y2: number, { width = 0.75, color: c = [0, 0, 0] }: { width?: number; color?: Rgb } = {}) {
    this.ops.push(`${color(c)} RG ${num(width)} w ${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S`);
    return this;
  }

  /** Rectangle de coin bas gauche (x, y) : plein (`fill`), contour (`stroke`) ou les deux. */
  rect(x: number, y: number, w: number, h: number, { fill, stroke, width = 0.75 }: { fill?: Rgb; stroke?: Rgb; width?: number } = {}) {
    const path = `${num(x)} ${num(y)} ${num(w)} ${num(h)} re`;
    if (fill && stroke) this.ops.push(`${color(fill)} rg ${color(stroke)} RG ${num(width)} w ${path} B`);
    else if (fill) this.ops.push(`${color(fill)} rg ${path} f`);
    else if (stroke) this.ops.push(`${color(stroke)} RG ${num(width)} w ${path} S`);
    return this;
  }
}

/** Chaîne d'information du document (titre, auteur) : UTF-16BE avec son BOM, en hexadécimal. */
function infoString(text: string) {
  const units = [0xfe, 0xff];
  for (let i = 0; i < text.length; i++) units.push(text.charCodeAt(i) >> 8, text.charCodeAt(i) & 0xff);
  return hexString(units);
}

const pdfDate = (d: Date) => `D:${d.toISOString().replace(/[-:T]/g, "").slice(0, 14)}Z`;

/**
 * Assemble le fichier PDF 1.4 : catalogue, arbre des pages, les deux polices, informations, pages et leurs flux ;
 * table des renvois (xref) aux positions exactes des objets, en octets.
 */
export function pdfDocument(pages: PdfPage[], info: { title?: string; author?: string; createdAt?: Date } = {}): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let size = 0;
  const push = (data: string | Uint8Array) => {
    const bytes = typeof data === "string" ? enc.encode(data) : data;
    chunks.push(bytes);
    size += bytes.length;
  };
  // Objets : 1 catalogue, 2 pages, 3 et 4 polices, 5 informations, puis pour chaque page son objet et son contenu.
  const pageId = (i: number) => 6 + i * 2;
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${pageId(i)} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Producer ${infoString("ClipBoost")}${info.title ? ` /Title ${infoString(info.title)}` : ""}${info.author ? ` /Author ${infoString(info.author)}` : ""} /CreationDate (${pdfDate(info.createdAt ?? new Date())}) >>`,
  ];
  for (const [i, p] of pages.entries()) {
    const content = p.ops.join("\n");
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(p.width)} ${num(p.height)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageId(i) + 1} 0 R >>`,
      `<< /Length ${enc.encode(content).length} >>\nstream\n${content}\nendstream`,
    );
  }
  // En-tête, puis une ligne de commentaire en octets > 127 : le fichier est reconnu comme binaire.
  push("%PDF-1.4\n");
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  for (const [i, body] of objects.entries()) {
    offsets.push(size);
    push(`${i + 1} 0 obj\n${body}\nendobj\n`);
  }
  const xref = size;
  // Chaque entrée fait exactement 20 octets (fin de ligne « espace + \n »).
  push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`);
  push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
