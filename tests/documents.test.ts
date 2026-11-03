import assert from "node:assert/strict";
import { test } from "node:test";
import { PdfPage, pdfDocument, textWidth, winAnsi } from "../lib/server/pdf";
import { companyFrom, csvFilename, documentLocale, documentNumber, documentSeq, invoicePdf, numberDocuments, receiptPdf, transactionsCsv } from "../lib/server/documents";

const latin1 = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join("");

/** Structure d'un PDF : en-tête, fin, table des renvois dont chaque position désigne bien le début de son objet. */
function assertValidPdf(bytes: Uint8Array) {
  const s = latin1(bytes);
  assert.ok(s.startsWith("%PDF-1.4\n"), "en-tête %PDF-");
  assert.ok(s.endsWith("%%EOF\n"), "fin %%EOF");
  const startxref = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(s)?.[1]);
  assert.ok(s.startsWith("xref\n", startxref), "startxref désigne la table des renvois");
  const [, first, count] = /^xref\n(\d+) (\d+)\n/.exec(s.slice(startxref))!;
  assert.equal(first, "0");
  const table = s.slice(startxref).split("\n").slice(2, 2 + Number(count));
  assert.equal(table[0], "0000000000 65535 f ");
  for (const [i, entry] of table.entries()) {
    assert.equal(entry.length + 1, 20, "entrée de 20 octets");
    if (i === 0) continue;
    assert.ok(s.startsWith(`${i} 0 obj\n`, Number(entry.slice(0, 10))), `position de l'objet ${i}`);
  }
  assert.match(s, new RegExp(`trailer\\n<< /Size ${count} /Root 1 0 R`));
  // Longueur déclarée de chaque flux de contenu.
  for (const m of s.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) {
    const start = m.index! + m[0].length;
    assert.ok(s.startsWith("\nendstream", start + Number(m[1])), "longueur du flux");
  }
}

const company = companyFrom({ COMPANY_NAME: "ClipBoost SARL", COMPANY_ADDRESS: "12 rue des Oliviers\\n16000 Alger", COMPANY_TAX_ID: "000216001234567" });
const data = {
  number: "FAC-2026-00001", locale: "fr", issuedAt: new Date("2026-10-08T10:12:00Z"), company,
  customer: { name: "Tassili Sport", email: "agence@clipboost.dz", contact: "Nassim Ait Ali" },
  transaction: { ref: "T-7K3F9Q", label: "Recharge par carte Visa / Mastercard · Visa •••• 4242", amount: 300000, fee: 0, method: "carte Visa / Mastercard", provider: null, createdAt: new Date("2026-10-08T09:40:00Z") },
};

test("PDF : structure valide (en-tête, %%EOF, positions de la table des renvois)", () => {
  const page = new PdfPage().text(40, 800, "Reçu n° 1 — 2 000 DA", { size: 12, font: "bold" }).line(40, 790, 300, 790).rect(40, 700, 100, 50, { fill: [0.5, 0.2, 0.9] });
  assertValidPdf(pdfDocument([page, new PdfPage().text(40, 800, "Page 2")], { title: "Essai « é »" }));
  assertValidPdf(invoicePdf(data));
  assertValidPdf(receiptPdf({ ...data, number: "REC-2026-00001", locale: "en", customer: { name: "Yacine Benali", email: "yacine@clipboost.dz" },
    transaction: { ...data.transaction, label: "Retrait instantané vers CCP", amount: -4000, fee: 100, method: "CCP" } }));
});

test("PDF : texte en WinAnsi (accents, euro, espaces fines), largeurs Helvetica", () => {
  assert.deepEqual(winAnsi("Été"), [0xc9, 0x74, 0xe9]);
  assert.deepEqual(winAnsi("2 000 € — ok"), [0x32, 0x20, 0x30, 0x30, 0x30, 0x20, 0x80, 0x20, 0x97, 0x20, 0x6f, 0x6b]);
  // Sans équivalent : l'accent disparaît (ő → o), sinon « ? » (arabe).
  assert.deepEqual(winAnsi("ő"), [0x6f]);
  assert.deepEqual(winAnsi("سلام"), [0x3f, 0x3f, 0x3f, 0x3f]);
  assert.equal(textWidth("ClipBoost", 10), 42.79);
  assert.ok(textWidth("ClipBoost", 10, "bold") > textWidth("ClipBoost", 10));
});

test("factures et reçus : contenu, langue du compte (l'arabe en français), mentions facultatives", () => {
  const text = (bytes: Uint8Array) => {
    // Les textes sont écrits en hexadécimal (<…> Tj) : on les relit en cp1252 (Latin-1 suffit ici).
    let out = "";
    for (const m of latin1(bytes).matchAll(/<([0-9a-f]+)> Tj/g)) out += `${m[1].match(/../g)!.map((h) => String.fromCharCode(parseInt(h, 16))).join("")}\n`;
    return out;
  };
  const fr = text(invoicePdf(data));
  for (const s of ["ClipBoost", "FACTURE", "N° FAC-2026-00001", "Tassili Sport", "Contact : Nassim Ait Ali", "agence@clipboost.dz", "T-7K3F9Q", "300 000 DA", "PAYÉE", "NIF : 000216001234567", "16000 Alger", "8 octobre 2026"]) {
    assert.ok(fr.includes(s), s);
  }
  assert.ok(text(invoicePdf({ ...data, locale: "ar" })).includes("FACTURE"));
  const en = text(receiptPdf({ ...data, number: "REC-2026-00007", locale: "en", company: companyFrom({}), transaction: { ...data.transaction, amount: -4000, fee: 100, method: "CCP", label: "Retrait instantané vers CCP" } }));
  for (const s of ["WITHDRAWAL RECEIPT", "No. REC-2026-00007", "4,000 DA", "-100 DA", "3,900 DA", "Instant withdrawal fee", "PAID OUT"]) assert.ok(en.includes(s), s);
  assert.ok(!en.includes("Tax ID"), "mentions vides omises");
  assert.equal(documentLocale("ar"), "fr");
});

test("numéros des documents : une suite par type et par année", () => {
  assert.equal(documentNumber("facture", 2026, 1), "FAC-2026-00001");
  assert.equal(documentNumber("recu", 2027, 123), "REC-2027-00123");
  assert.equal(documentSeq("FAC-2026-00042"), 42);
  assert.equal(documentSeq("x"), 0);
  const at = (s: string) => Date.parse(s);
  assert.deepEqual(numberDocuments([
    { kind: "facture", at: at("2026-03-01") }, { kind: "recu", at: at("2026-02-01") }, { kind: "facture", at: at("2026-01-15") }, { kind: "facture", at: at("2027-01-02") },
  ]), ["FAC-2026-00002", "REC-2026-00001", "FAC-2026-00001", "FAC-2027-00001"]);
});

test("export CSV : BOM, « ; », guillemets, formules neutralisées", () => {
  const csv = transactionsCsv([
    { ref: "T-AAAAAA", createdAt: new Date("2026-10-19T08:05:00Z"), type: "retrait", userName: "Yacine; \"Y\"", email: "y@x.dz", role: "clipper", label: "=HYPERLINK(1)", amount: -2000, fee: 100, status: "Validé", method: "CCP", document: "REC-2026-00001" },
    { ref: "T-BBBBBB", createdAt: new Date("2026-10-19T23:59:00Z"), type: "gain", userName: "Lina", email: "l@x.dz", role: "clipper", label: "Derby", amount: 750, fee: 0, status: "Validé", method: null, document: null },
  ]);
  assert.ok(csv.startsWith("﻿Référence;Date;Heure;Type;Utilisateur;Email;Rôle;Libellé;Montant (DA);Frais (DA);Statut;Moyen;Document\r\n"));
  const lines = csv.slice(1).split("\r\n");
  assert.equal(lines[1], "T-AAAAAA;19/10/2026;08:05;Retrait;\"Yacine; \"\"Y\"\"\";y@x.dz;Clipper;'=HYPERLINK(1);-2000;100;Validé;CCP;REC-2026-00001");
  assert.equal(lines[2], "T-BBBBBB;19/10/2026;23:59;Gain;Lina;l@x.dz;Clipper;Derby;750;0;Validé;;");
  assert.equal(lines[3], "");
  assert.equal(csvFilename(new Date("2026-10-19T12:00:00Z")), "clipboost-transactions-2026-10-19.csv");
});
