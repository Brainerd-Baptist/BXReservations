// Itemized invoice / receipt for one booking (Letter, branded like the signs & packet).
import { rgb, type PDFPage } from "pdf-lib";
import { newDoc, wrap, b64, NAVY, TEAL, TEAL_SOFT, SLATE, RULE } from "@/lib/signs/pdf-common";
import { WORDMARK_WHITE_PNG_B64, WORDMARK_WHITE_ASPECT } from "@/lib/signs/wordmark-white";
import type { Billing } from "@/lib/billing";
import { CHARGE_KIND_LABEL } from "@/lib/billing";
import { ROOMS } from "@/lib/rooms";

export interface InvoiceInput {
  bookingNumber: string;
  eventName: string;
  status: string | null;
  contact: { name: string; org?: string | null; email?: string | null; phone?: string | null };
  days: { date: string; start?: string; end?: string; rooms: string[] }[];
  billing: Billing;
  venue: { name: string; address?: string };
  issuedYmd: string;      // venue-local date
  paymentNote?: string;   // how to pay
}

const INK = rgb(0.07, 0.09, 0.15);
const W = 612, H = 792, M = 48;
const money = (n: number) => (n < 0 ? "-" : "") + "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const longDate = (ymd: string) =>
  new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${ymd}T12:00:00Z`));
const time12 = (t?: string) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "pm" : "am", hh = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hh}:${String(m).padStart(2, "0")}${ap}` : `${hh}${ap}`;
};
const roomName = (id: string) => ROOMS.find((r) => r.id === id)?.name ?? id;

export async function renderInvoice(inv: InvoiceInput): Promise<Uint8Array> {
  const paid = inv.billing.totals.balance <= 0 && inv.billing.totals.charges > 0;
  const title = paid ? "Receipt" : "Invoice";
  const { pdf, fonts, wordmark } = await newDoc(`${title} ${inv.bookingNumber} — ${inv.eventName}`, "BX Reservations invoices");
  const { medium, bold, xbold } = fonts;

  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;
  const pages: PDFPage[] = [page];
  const text = (t: string, x: number, yy: number, size: number, font = medium, color = INK) => page.drawText(t, { x, y: yy, size, font, color });
  const right = (t: string, xr: number, yy: number, size: number, font = medium, color = INK) =>
    page.drawText(t, { x: xr - font.widthOfTextAtSize(t, size), y: yy, size, font, color });
  const newPage = () => { page = pdf.addPage([W, H]); pages.push(page); y = H - M; };
  const need = (h: number) => { if (y - h < M + 40) { newPage(); tableHeader(); } };

  // ── Header band
  page.drawRectangle({ x: 0, y: H - 108, width: W, height: 108, color: NAVY });
  const wmH = 32, wmW = wmH * WORDMARK_WHITE_ASPECT;
  const white = await pdf.embedPng(b64(WORDMARK_WHITE_PNG_B64));
  void wordmark;
  page.drawImage(white, { x: M, y: H - 70, width: wmH * WORDMARK_WHITE_ASPECT, height: wmH });
  page.drawText("Brainerd Baptist Church", { x: M + wmW + 18, y: H - 54, size: 10, font: bold, color: rgb(1, 1, 1) });
  page.drawText(inv.venue.name, { x: M + wmW + 18, y: H - 68, size: 8.5, font: medium, color: rgb(0.8, 0.86, 0.94) });
  page.drawText(title.toUpperCase(), { x: W - M - xbold.widthOfTextAtSize(title.toUpperCase(), 26), y: H - 60, size: 26, font: xbold, color: rgb(1, 1, 1) });
  const invNo = `${inv.bookingNumber}${paid ? "-R" : "-INV"}`;
  page.drawText(invNo, { x: W - M - medium.widthOfTextAtSize(invNo, 9.5), y: H - 78, size: 9.5, font: medium, color: rgb(0.8, 0.86, 0.94) });
  y = H - 140;

  // ── Parties
  const colW = (W - 2 * M - 24) / 3;
  const block = (x: number, label: string, lines: string[]) => {
    text(label.toUpperCase(), x, y, 7.5, bold, SLATE);
    let yy = y - 14;
    for (const l of lines.filter(Boolean)) {
      for (const w of wrap(medium, l, 9.5, colW)) { text(w, x, yy, 9.5); yy -= 13; }
    }
    return yy;
  };
  const b1 = block(M, "Bill to", [inv.contact.name, inv.contact.org ?? "", inv.contact.email ?? "", inv.contact.phone ?? ""]);
  const b2 = block(M + colW + 12, "From", [inv.venue.name, ...(inv.venue.address ? (() => { const i = inv.venue.address!.indexOf(","); return i > 0 ? [inv.venue.address!.slice(0, i), inv.venue.address!.slice(i + 1).trim()] : [inv.venue.address!]; })() : []), "BXreservations@brainerdbaptist.org"]);
  const b3 = block(M + 2 * (colW + 12), "Details", [`Issued ${longDate(inv.issuedYmd)}`, `Booking ${inv.bookingNumber}`, inv.status ? `Status: ${inv.status.replace(/_/g, " ")}` : ""]);
  y = Math.min(b1, b2, b3) - 10;

  // ── Event
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: RULE });
  y -= 20;
  text(inv.eventName, M, y, 14, bold, NAVY);
  y -= 16;
  for (const d of inv.days) {
    const when = [longDate(d.date), d.start && d.end ? `${time12(d.start)}–${time12(d.end)}` : ""].filter(Boolean).join(" · ");
    const where = d.rooms.map(roomName).join(", ");
    for (const l of wrap(medium, `${when}${where ? ` — ${where}` : ""}`, 9.5, W - 2 * M)) { need(14); text(l, M, y, 9.5, medium, SLATE); y -= 13; }
  }
  y -= 12;

  // ── Line items
  const cDesc = M + 10, cQty = W - M - 200, cUnit = W - M - 100, cAmt = W - M - 10;
  function tableHeader() {
    page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 22, color: TEAL_SOFT });
    text("DESCRIPTION", cDesc, y + 1, 7.5, bold, NAVY);
    right("QTY", cQty, y + 1, 7.5, bold, NAVY);
    right("UNIT", cUnit, y + 1, 7.5, bold, NAVY);
    right("AMOUNT", cAmt, y + 1, 7.5, bold, NAVY);
    y -= 24;
  }
  tableHeader();
  const charges = inv.billing.charges;
  if (!charges.length) { text("No charges yet.", cDesc, y, 9.5, medium, SLATE); y -= 18; }
  charges.forEach((c, i) => {
    const lines = wrap(medium, c.label, 9.5, cQty - cDesc - 60);
    const sub = [CHARGE_KIND_LABEL[c.kind], c.note].filter(Boolean).join(" · ");
    const h = lines.length * 12 + (sub ? 11 : 0) + 10;
    need(h);
    if (i % 2 === 1) page.drawRectangle({ x: M, y: y - h + 12, width: W - 2 * M, height: h, color: rgb(0.975, 0.98, 0.985) });
    let yy = y;
    lines.forEach((l) => { text(l, cDesc, yy, 9.5); yy -= 12; });
    if (sub) { text(sub, cDesc, yy, 7.5, medium, SLATE); }
    right(c.quantity % 1 ? c.quantity.toFixed(2) : String(c.quantity), cQty, y, 9.5);
    right(money(c.unit_price), cUnit, y, 9.5);
    right(money(c.amount), cAmt, y, 9.5, bold);
    y -= h;
  });
  page.drawLine({ start: { x: M, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 0.6, color: RULE });
  y -= 10;

  // ── Totals
  const pos = charges.filter((c) => c.amount > 0).reduce((s, c) => s + c.amount, 0);
  const neg = charges.filter((c) => c.amount < 0).reduce((s, c) => s + c.amount, 0);
  const { charges: total, paid: paidAmt, balance } = inv.billing.totals;
  const tx = W - M - 220;
  const row = (label: string, value: string, strong = false) => {
    need(16);
    text(label, tx, y, strong ? 10.5 : 9.5, strong ? bold : medium, strong ? NAVY : SLATE);
    right(value, cAmt, y, strong ? 10.5 : 9.5, strong ? bold : medium, strong ? NAVY : INK);
    y -= 15;
  };
  row("Subtotal", money(pos));
  if (neg) row("Discounts", money(neg));
  row("Total", money(total), true);
  row("Paid", money(-paidAmt));
  y -= 10;
  need(34);
  page.drawRectangle({ x: tx - 10, y: y - 10, width: cAmt - tx + 20, height: 28, color: balance > 0 ? TEAL : rgb(0.13, 0.55, 0.3) });
  page.drawText(balance > 0 ? "BALANCE DUE" : balance < 0 ? "CREDIT" : "PAID IN FULL", { x: tx, y: y, size: 10, font: xbold, color: rgb(1, 1, 1) });
  const bv = money(Math.abs(balance));
  page.drawText(bv, { x: cAmt - xbold.widthOfTextAtSize(bv, 12), y: y - 1, size: 12, font: xbold, color: rgb(1, 1, 1) });
  y -= 36;

  // ── Payments received
  if (inv.billing.payments.length) {
    need(40);
    text("PAYMENTS RECEIVED", M, y, 7.5, bold, SLATE);
    y -= 15;
    for (const p of inv.billing.payments) {
      need(14);
      text(`${longDate(p.received_at)} · ${p.method}${p.note ? ` · ${p.note}` : ""}`, M, y, 9.5, medium, INK);
      right(money(p.amount), cAmt, y, 9.5, bold);
      y -= 14;
    }
    y -= 8;
  }

  // ── How to pay
  if (!paid && inv.paymentNote) {
    const lines = wrap(medium, inv.paymentNote, 9, W - 2 * M - 24);
    need(lines.length * 12 + 30);
    const bh = lines.length * 12 + 26;
    page.drawRectangle({ x: M, y: y - bh + 12, width: W - 2 * M, height: bh, borderColor: RULE, borderWidth: 0.8, color: rgb(1, 1, 1) });
    text("HOW TO PAY", M + 12, y - 2, 7.5, bold, NAVY);
    let yy = y - 16;
    for (const l of lines) { text(l, M + 12, yy, 9, medium, INK); yy -= 12; }
    y -= bh + 6;
  }

  // ── Footer on every page
  pages.forEach((pg, i) => {
    const f = `Thank you for gathering at the BX · Questions? BXreservations@brainerdbaptist.org`;
    pg.drawLine({ start: { x: M, y: 40 }, end: { x: W - M, y: 40 }, thickness: 0.5, color: RULE });
    pg.drawText(f, { x: M, y: 26, size: 7.5, font: medium, color: SLATE });
    const pn = `${invNo} · Page ${i + 1} of ${pages.length}`;
    pg.drawText(pn, { x: W - M - medium.widthOfTextAtSize(pn, 7.5), y: 26, size: 7.5, font: medium, color: SLATE });
  });

  return pdf.save();
}
