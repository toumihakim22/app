// Factures (recharges validées des agences), reçus (retraits validés des clippers) et export CSV des transactions.
// Module pur, partagé par le serveur (lib/server/services/documents.ts) et la version autonome (web/offline/documents.ts) :
// mêmes numéros, même mise en page, mêmes colonnes. Les PDF sont en français ou en anglais selon la langue du compte ;
// un compte en arabe reçoit la version française (les polices standard des PDF n'ont pas de glyphes arabes).
import { A4, hex, PdfPage, pdfDocument, textWidth, wrapText, type Rgb } from "./pdf";

export type DocumentKind = "facture" | "recu";
export type DocumentLocale = "fr" | "en";

/** Émetteur des documents : ClipBoost, et les mentions légales facultatives (COMPANY_NAME, COMPANY_ADDRESS, COMPANY_TAX_ID). */
export type Company = { name: string; address: string; taxId: string };

/** Mentions de l'émetteur lues dans l'environnement (serveur) ; vides, elles sont omises du document. */
export function companyFrom(env: Record<string, string | undefined>): Company {
  return {
    name: (env.COMPANY_NAME ?? "").trim(),
    // Adresse sur plusieurs lignes : « \n » écrit tel quel dans la variable est accepté.
    address: (env.COMPANY_ADDRESS ?? "").replace(/\\n/g, "\n").trim(),
    taxId: (env.COMPANY_TAX_ID ?? "").trim(),
  };
}

export type DocumentData = {
  kind: DocumentKind;
  number: string;
  /** Langue du compte du client ; « ar » donne un document en français. */
  locale: string;
  /** Date d'émission : validation de la recharge ou du retrait. */
  issuedAt: Date;
  company: Company;
  customer: { name: string; email: string; contact?: string | null };
  transaction: { ref: string; label: string; amount: number; fee: number; method: string | null; provider: string | null; createdAt: Date };
};

/** Préfixe des numéros : FAC (factures) et REC (reçus). */
export const DOCUMENT_PREFIX: Record<DocumentKind, string> = { facture: "FAC", recu: "REC" };

/** Numéro d'un document : « FAC-2026-00001 », suite propre à chaque type et à chaque année. */
export const documentNumber = (kind: DocumentKind, year: number, seq: number) => `${DOCUMENT_PREFIX[kind]}-${year}-${String(seq).padStart(5, "0")}`;

/** Rang d'un numéro dans sa suite (« FAC-2026-00012 » → 12), 0 s'il n'en est pas un. */
export const documentSeq = (number: string) => Number(/^[A-Z]{3}-\d{4}-(\d+)$/.exec(number)?.[1] ?? 0);

/** Type de document d'une transaction validée : facture pour une recharge, reçu pour un retrait ; aucun pour un gain. */
export const documentKindOf = (type: string): DocumentKind | null => (type === "recharge" ? "facture" : type === "retrait" ? "recu" : null);

export const documentFilename = (number: string) => `${number}.pdf`;

/**
 * Numéros de documents émis aux dates données (données d'exemple, base vide) : suites par type et par année, dans
 * l'ordre des dates, comme le rattrapage de la migration 0007. Renvoie les numéros dans l'ordre des entrées.
 */
export function numberDocuments(items: { kind: DocumentKind; at: number }[]): string[] {
  const order = items.map((x, i) => ({ ...x, i })).sort((a, b) => a.at - b.at);
  const seq = new Map<string, number>(), out: string[] = [];
  for (const x of order) {
    const year = new Date(x.at).getUTCFullYear(), key = `${x.kind}-${year}`, n = (seq.get(key) ?? 0) + 1;
    seq.set(key, n);
    out[x.i] = documentNumber(x.kind, year, n);
  }
  return out;
}

const LABELS = {
  fr: {
    tagline: "Clipping payé à la vue",
    facture: "FACTURE", recu: "REÇU DE RETRAIT", number: "N°",
    issuer: "ÉMETTEUR", billedTo: "FACTURÉ À", paidTo: "BÉNÉFICIAIRE", contact: "Contact", taxId: "NIF", colon: " : ",
    issued: "Date d'émission", rechargeDate: "Date de la recharge", requestDate: "Date de la demande",
    reference: "Référence de la transaction", payMethod: "Moyen de paiement", payoutMethod: "Versé par",
    description: "Description", qty: "Qté", unit: "Prix unitaire", amount: "Montant",
    topUp: "Recharge du crédit prépayé ClipBoost", topUpSub: "Crédit utilisé pour le budget et la commission de vos campagnes",
    withdrawal: "Retrait de vos gains ClipBoost", standard: "Retrait standard", instant: "Retrait instantané", fee: "Frais de retrait instantané",
    subtotal: "Sous-total", total: "Total", paid: "Montant payé", due: "Reste à payer",
    requested: "Montant demandé", fees: "Frais", net: "Net versé",
    paidStamp: "PAYÉE", paidOutStamp: "VERSÉ",
    online: "paiement en ligne, Chargily Pay",
    invoiceNote: "Recharge confirmée : le montant a été ajouté au crédit prépayé de votre agence. Montants en DA.",
    receiptNote: "Ce reçu confirme le versement de vos gains sur le compte enregistré dans votre profil. Montants en DA.",
    generated: "Document généré électroniquement par ClipBoost le {date}.", thanks: "Merci de votre confiance.", page: "Page {n} / {total}",
    methods: { "virement bancaire": "Virement bancaire", "carte Visa / Mastercard": "Carte Visa / Mastercard", "carte Edahabia": "Carte Edahabia", "carte CIB": "Carte CIB", BaridiMob: "BaridiMob", CCP: "CCP", "RIB bancaire": "Virement sur RIB bancaire" } as Record<string, string>,
    dateLocale: "fr-FR", group: " ",
  },
  en: {
    tagline: "Pay-per-view clipping",
    facture: "INVOICE", recu: "WITHDRAWAL RECEIPT", number: "No.",
    issuer: "FROM", billedTo: "BILLED TO", paidTo: "PAID TO", contact: "Contact", taxId: "Tax ID", colon: ": ",
    issued: "Issue date", rechargeDate: "Top-up date", requestDate: "Request date",
    reference: "Transaction reference", payMethod: "Payment method", payoutMethod: "Paid by",
    description: "Description", qty: "Qty", unit: "Unit price", amount: "Amount",
    topUp: "ClipBoost prepaid credit top-up", topUpSub: "Credit used for your campaigns' budget and commission",
    withdrawal: "Withdrawal of your ClipBoost earnings", standard: "Standard withdrawal", instant: "Instant withdrawal", fee: "Instant withdrawal fee",
    subtotal: "Subtotal", total: "Total", paid: "Amount paid", due: "Balance due",
    requested: "Amount requested", fees: "Fees", net: "Net paid out",
    paidStamp: "PAID", paidOutStamp: "PAID OUT",
    online: "online payment, Chargily Pay",
    invoiceNote: "Top-up confirmed: the amount was added to your agency's prepaid credit. Amounts in DA.",
    receiptNote: "This receipt confirms that your earnings were paid to the account saved in your profile. Amounts in DA.",
    generated: "Document generated electronically by ClipBoost on {date}.", thanks: "Thank you for your business.", page: "Page {n} of {total}",
    methods: { "virement bancaire": "Bank transfer", "carte Visa / Mastercard": "Visa / Mastercard card", "carte Edahabia": "Edahabia card", "carte CIB": "CIB card", BaridiMob: "BaridiMob", CCP: "CCP", "RIB bancaire": "Bank account (RIB)" } as Record<string, string>,
    dateLocale: "en-GB", group: ",",
  },
};
type Labels = (typeof LABELS)["fr"];

/** Langue d'un document : celle du compte pour le français et l'anglais, le français pour l'arabe. */
export const documentLocale = (locale: string): DocumentLocale => (locale === "en" ? "en" : "fr");

const amountText = (n: number, L: Labels) => `${n < 0 ? "-" : ""}${String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, L.group)} DA`;
const dateText = (d: Date, L: Labels) => d.toLocaleDateString(L.dateLocale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));

/** Moyen de paiement lisible : « Carte Visa / Mastercard · Visa •••• 4242 », « Carte CIB (paiement en ligne, Chargily Pay) ». */
function methodText(t: DocumentData["transaction"], L: Labels) {
  const m = t.method ?? "";
  let text = L.methods[m] ?? (m ? m.charAt(0).toUpperCase() + m.slice(1) : "—");
  const card = /· (Visa|Mastercard) •••• (\d{4})$/.exec(t.label);
  if (card) text += ` · ${card[1]} •••• ${card[2]}`;
  if (t.provider === "chargily") text += ` (${L.online})`;
  return text;
}

// Palette du document : violet de la marque, encre, gris de texte secondaire et de filets, fond des encadrés.
const BRAND = hex("#7c3aed"), BRAND_DARK = hex("#5b21b6"), BRAND_SOFT = hex("#f3eefe"), BRAND_ON = hex("#e9ddff");
const INK = hex("#1f1b2d"), MUTED = hex("#6b6880"), LINE = hex("#e4e1ee"), PANEL = hex("#f7f6fb"), WHITE: Rgb = [1, 1, 1], SUCCESS = hex("#15803d");

/** Facture ou reçu : un document A4 d'une page (bandeau, parties, informations, lignes, totaux, mentions, pied). */
function renderDocument(d: DocumentData): Uint8Array<ArrayBuffer> {
  const L = LABELS[documentLocale(d.locale)];
  const invoice = d.kind === "facture";
  const p = new PdfPage();
  const W = A4.width, H = A4.height, M = 48, R = W - M;
  const t = d.transaction, gross = Math.abs(t.amount);

  // Bandeau de la marque : « ClipBoost » à gauche, type et numéro du document à droite.
  p.rect(0, H - 118, W, 118, { fill: BRAND });
  p.text(M, H - 62, "ClipBoost", { size: 28, font: "bold", color: WHITE });
  p.text(M, H - 82, L.tagline, { size: 10, color: BRAND_ON });
  p.text(R, H - 58, L[d.kind], { size: 18, font: "bold", color: WHITE, align: "right" });
  p.text(R, H - 78, `${L.number} ${d.number}`, { size: 11, color: BRAND_ON, align: "right" });

  // Émetteur et client.
  let y = H - 160;
  const block = (x: number, title: string, lines: [string, boolean][]) => {
    p.text(x, y, title, { size: 8, font: "bold", color: MUTED });
    let ly = y - 18;
    for (const [line, strong] of lines) {
      for (const part of wrapText(line, strong ? 12 : 10, 230, strong ? "bold" : "regular")) {
        p.text(x, ly, part, { size: strong ? 12 : 10, font: strong ? "bold" : "regular", color: strong ? INK : MUTED });
        ly -= strong ? 16 : 13;
      }
    }
    return ly;
  };
  const issuer: [string, boolean][] = [[d.company.name || "ClipBoost", true]];
  if (d.company.name && d.company.name !== "ClipBoost") issuer.push(["ClipBoost", false]);
  for (const line of d.company.address.split("\n").filter(Boolean)) issuer.push([line, false]);
  if (d.company.taxId) issuer.push([`${L.taxId}${L.colon}${d.company.taxId}`, false]);
  const customer: [string, boolean][] = [[d.customer.name, true]];
  if (d.customer.contact) customer.push([`${L.contact}${L.colon}${d.customer.contact}`, false]);
  customer.push([d.customer.email, false]);
  y = Math.min(block(M, L.issuer, issuer), block(W / 2 + 12, invoice ? L.billedTo : L.paidTo, customer)) - 14;

  // Informations : dates, référence de la transaction, moyen de paiement (2 colonnes, 2 rangées).
  const cellW = (R - M - 40) / 2;
  const cells: [string, string][] = [
    [L.issued, dateText(d.issuedAt, L)], [invoice ? L.rechargeDate : L.requestDate, dateText(t.createdAt, L)],
    [L.reference, t.ref], [invoice ? L.payMethod : L.payoutMethod, methodText(t, L)],
  ];
  const valueLines = cells.map(([, v]) => wrapText(v, 10.5, cellW, "bold"));
  const rowH = (i: number) => 30 + 13 * (Math.max(valueLines[i].length, valueLines[i + 1].length) - 1);
  const boxH = 16 + rowH(0) + rowH(2) + 4;
  p.rect(M, y - boxH, R - M, boxH, { fill: PANEL });
  let cy = y - 24;
  for (const row of [0, 2]) {
    for (const col of [0, 1]) {
      const i = row + col, x = M + 16 + col * (cellW + 16);
      p.text(x, cy, cells[i][0], { size: 8.5, color: MUTED });
      valueLines[i].forEach((line, k) => p.text(x, cy - 14 - k * 13, line, { size: 10.5, font: "bold", color: INK }));
    }
    cy -= rowH(row);
  }
  y -= boxH + 28;

  // Lignes du document.
  const cQty = 352, cUnit = 446, cAmt = R - 12;
  p.rect(M, y - 8, R - M, 24, { fill: BRAND_SOFT });
  p.text(M + 12, y, L.description, { size: 9, font: "bold", color: BRAND_DARK });
  p.text(cQty, y, L.qty, { size: 9, font: "bold", color: BRAND_DARK, align: "right" });
  p.text(cUnit, y, L.unit, { size: 9, font: "bold", color: BRAND_DARK, align: "right" });
  p.text(cAmt, y, L.amount, { size: 9, font: "bold", color: BRAND_DARK, align: "right" });
  y -= 30;
  const lines: { title: string; sub: string; amount: number }[] = invoice
    ? [{ title: L.topUp, sub: L.topUpSub, amount: gross }]
    : [{ title: L.withdrawal, sub: `${t.fee ? L.instant : L.standard} · ${methodText(t, L)}`, amount: gross }, ...(t.fee ? [{ title: L.fee, sub: "", amount: -t.fee }] : [])];
  for (const line of lines) {
    p.text(M + 12, y, line.title, { size: 10.5, font: "bold", color: INK });
    const sub = line.sub ? wrapText(line.sub, 9, cQty - M - 50) : [];
    sub.forEach((s, k) => p.text(M + 12, y - 14 - k * 12, s, { size: 9, color: MUTED }));
    p.text(cQty, y, "1", { size: 10.5, color: INK, align: "right" });
    p.text(cUnit, y, amountText(line.amount, L), { size: 10.5, color: INK, align: "right" });
    p.text(cAmt, y, amountText(line.amount, L), { size: 10.5, color: INK, align: "right" });
    y -= 24 + 12 * sub.length;
    p.line(M, y + 8, R, y + 8, { color: LINE });
    y -= 10;
  }

  // Totaux, à droite ; le montant final sur fond de la marque.
  const tx = W / 2 + 20, net = gross - t.fee;
  const totals: [string, string][] = invoice
    ? [[L.subtotal, amountText(gross, L)], [L.paid, amountText(gross, L)], [L.due, amountText(0, L)]]
    : [[L.requested, amountText(gross, L)], [L.fees, t.fee ? amountText(-t.fee, L) : amountText(0, L)]];
  const stampY = y;
  for (const [label, value] of totals) {
    p.text(tx + 12, y, label, { size: 10, color: MUTED });
    p.text(cAmt, y, value, { size: 10, color: INK, align: "right" });
    y -= 18;
  }
  y -= 12;
  p.rect(tx, y - 11, R - tx, 30, { fill: BRAND });
  p.text(tx + 12, y, invoice ? L.total : L.net, { size: 11.5, font: "bold", color: WHITE });
  p.text(cAmt, y, amountText(invoice ? gross : net, L), { size: 13, font: "bold", color: WHITE, align: "right" });

  // Tampon « Payée » / « Versé », à gauche des totaux.
  const stamp = invoice ? L.paidStamp : L.paidOutStamp, sw = textWidth(stamp, 15, "bold") + 28;
  p.rect(M, stampY - 22, sw, 32, { stroke: SUCCESS, width: 1.6 });
  p.text(M + sw / 2, stampY - 11, stamp, { size: 15, font: "bold", color: SUCCESS, align: "center" });
  p.text(M, stampY - 40, dateText(d.issuedAt, L), { size: 9, color: MUTED });
  y -= 48;

  // Mention, puis pied de page.
  for (const line of wrapText(invoice ? L.invoiceNote : L.receiptNote, 9.5, R - M)) {
    p.text(M, y, line, { size: 9.5, color: MUTED });
    y -= 13;
  }
  p.text(M, y - 6, L.thanks, { size: 9.5, font: "bold", color: BRAND_DARK });
  p.line(M, 64, R, 64, { color: LINE });
  const legal = [d.company.name || "ClipBoost", d.company.taxId ? `${L.taxId}${L.colon}${d.company.taxId}` : ""].filter(Boolean).join(" · ");
  p.text(M, 46, legal, { size: 8.5, color: MUTED });
  p.text(R, 46, `${d.number} · ${fill(L.page, { n: 1, total: 1 })}`, { size: 8.5, color: MUTED, align: "right" });
  p.text(M, 32, fill(L.generated, { date: dateText(d.issuedAt, L) }), { size: 8, color: MUTED });

  return pdfDocument([p], { title: `${L[d.kind]} ${d.number}`, author: d.company.name || "ClipBoost", createdAt: d.issuedAt });
}

/** Facture d'une recharge validée (agence). */
export const invoicePdf = (d: Omit<DocumentData, "kind">) => renderDocument({ ...d, kind: "facture" });

/** Reçu d'un retrait validé (clipper) : montant demandé, frais du retrait instantané, net versé. */
export const receiptPdf = (d: Omit<DocumentData, "kind">) => renderDocument({ ...d, kind: "recu" });

/** Document d'une transaction selon son type. */
export const documentPdf = (d: DocumentData) => (d.kind === "facture" ? invoicePdf(d) : receiptPdf(d));

// ---------- Export CSV des transactions (administration) ----------

export type ExportFilters = { type?: "gain" | "retrait" | "recharge"; status?: "Validé" | "En cours" | "Refusé"; from?: string; to?: string };

/** Bornes de dates d'un export : du début du jour « from » à la fin du jour « to » (UTC), inclus. */
export const exportRange = (f: ExportFilters) => ({
  from: f.from ? Date.parse(`${f.from}T00:00:00Z`) : null,
  to: f.to ? Date.parse(`${f.to}T00:00:00Z`) + 86_400_000 : null,
});

export type CsvTransaction = {
  ref: string; createdAt: Date; type: string; userName: string; email: string; role: string; label: string;
  amount: number; fee: number; status: string; method: string | null; document: string | null;
};

export const CSV_COLUMNS = ["Référence", "Date", "Heure", "Type", "Utilisateur", "Email", "Rôle", "Libellé", "Montant (DA)", "Frais (DA)", "Statut", "Moyen", "Document"];
const TYPE_LABEL: Record<string, string> = { gain: "Gain", retrait: "Retrait", recharge: "Recharge" };
const ROLE_LABEL: Record<string, string> = { clipper: "Clipper", agence: "Agence", admin: "Admin" };

/**
 * Cellule CSV : entre guillemets si elle contient le séparateur, un guillemet ou un retour à la ligne. Un texte saisi
 * par un utilisateur qui commence par = + - @ est préfixé d'une apostrophe (pas de formule exécutée par le tableur).
 */
function cell(value: string | number, text = true) {
  let s = String(value);
  if (text && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV pour Excel en français : BOM UTF-8, séparateur « ; », fins de ligne CRLF, dates et heures UTC. */
export function transactionsCsv(rows: CsvTransaction[]): string {
  const lines = [CSV_COLUMNS.join(";")];
  for (const r of rows) {
    const iso = r.createdAt.toISOString();
    lines.push([
      cell(r.ref), `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`, iso.slice(11, 16), cell(TYPE_LABEL[r.type] ?? r.type), cell(r.userName), cell(r.email),
      cell(ROLE_LABEL[r.role] ?? r.role), cell(r.label), cell(r.amount, false), cell(r.fee, false), cell(r.status), cell(r.method ?? ""), cell(r.document ?? ""),
    ].join(";"));
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** Nom du fichier exporté : « clipboost-transactions-2026-10-19.csv ». */
export const csvFilename = (now = new Date()) => `clipboost-transactions-${now.toISOString().slice(0, 10)}.csv`;
