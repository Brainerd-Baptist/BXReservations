// Door signs — one locked template, one page per room, letter portrait.
//
// The renter's logo is the only variable. Type (Archivo), colour (Brainerd
// navy + BX teal), spacing, the floor-plan inset, the QR and the BX wordmark
// are the template's, identical on every sign for every event. Admins change
// the look only by shipping a new TEMPLATE_VERSION; renters get no knobs.
//
// Pure function of its inputs: nothing is cached, so a name change ten minutes
// before doors open is just a re-download.

import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { ARCHIVO_BOLD_B64, ARCHIVO_MEDIUM_B64, ARCHIVO_XBOLD_B64, WORDMARK_ASPECT, WORDMARK_PNG_B64 } from "./assets";
import { MAP_GEOMETRY } from "@/app/bx-map/map-bundle";

export const TEMPLATE_VERSION = "1";

// ── page geometry (points) ────────────────────────────────────────────────
const PAGE_W = 612, PAGE_H = 792;
const M = 54;                     // outer margin
const W = PAGE_W - M * 2;         // content width
const LOGO_TOP = PAGE_H - M;      // 738
const LOGO_H = 132;
const RULE_Y = LOGO_TOP - LOGO_H - 16;
const FOOT_RULE_Y = 118;
const INSET_W = 210, INSET_H = 132, INSET_Y = 150;
const QR_SIZE = 96, QR_Y = 160;

// ── colour ────────────────────────────────────────────────────────────────
const NAVY = rgb(0, 0.125, 0.357);      // #00205b
const TEAL = rgb(0, 0.671, 0.788);      // #00abc9
const SLATE = rgb(0.42, 0.447, 0.502);  // #6b7280
const RULE = rgb(0.85, 0.87, 0.9);
const PLAN_FILL = rgb(0.933, 0.945, 0.96);
const PLAN_LINE = rgb(0.72, 0.76, 0.81);

export type SignVariant = "public" | "staff";

export interface SignPage {
  kind: "room" | "wayfinding";
  roomId: string;
  level: "lower" | "upper";
  /** The building's name for the space. */
  realName: string;
  /** What the sign says big: the event's name for the room, or the wayfinding note. */
  title: string;
  /** Staff variant only. */
  dayLabel?: string | null;
  setupLine?: string | null;
  notes?: string | null;
  staffNotes?: string | null;
}

export interface SignJob {
  eventName: string;
  dates: string[]; // ISO yyyy-mm-dd, sorted
  bookingNumber?: string | null;
  variant: SignVariant;
  pages: SignPage[];
  /** Normalised PNG of the approved logo, or null for the typographic lockup. */
  logoPng?: Buffer | Uint8Array | null;
  /** Absolute URL the QR points at, given a room id. */
  qrUrlFor: (roomId: string) => string;
  generatedAt?: Date;
}

interface Fonts { medium: PDFFont; bold: PDFFont; xbold: PDFFont }

export async function renderDoorSigns(job: SignJob): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`${job.eventName} — door signs`);
  pdf.setAuthor("BX Reservations · Brainerd Baptist Church");
  pdf.setProducer(`BX door-sign template v${TEMPLATE_VERSION}`);
  pdf.setCreationDate(job.generatedAt ?? new Date());

  const fonts: Fonts = {
    medium: await pdf.embedFont(b64(ARCHIVO_MEDIUM_B64), { subset: true }),
    bold: await pdf.embedFont(b64(ARCHIVO_BOLD_B64), { subset: true }),
    xbold: await pdf.embedFont(b64(ARCHIVO_XBOLD_B64), { subset: true }),
  };
  const wordmark = await pdf.embedPng(b64(WORDMARK_PNG_B64));
  const logo = job.logoPng ? await pdf.embedPng(job.logoPng) : null;
  const dates = formatDates(job.dates);

  for (const p of job.pages) {
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    drawLogoZone(page, fonts, logo, job.eventName);
    page.drawLine({ start: { x: M, y: RULE_Y }, end: { x: PAGE_W - M, y: RULE_Y }, thickness: 0.75, color: RULE });
    let y = drawTitle(page, fonts, p);
    y = drawSubtitle(page, fonts, p, job.eventName, dates.long, y);
    drawInset(page, fonts, p.level, p.roomId);
    if (job.variant === "staff") drawStaffBlock(page, fonts, p, y);   // the crew's column, where attendees get the QR
    else drawQr(page, fonts, job.qrUrlFor(p.roomId));
    drawFooter(page, fonts, wordmark, dates.short, job, p);
  }
  return pdf.save();
}

// ── pieces ────────────────────────────────────────────────────────────────

function drawLogoZone(page: PDFPage, f: Fonts, logo: PDFImage | null, eventName: string) {
  const zoneY = LOGO_TOP - LOGO_H;
  if (logo) {
    // contain inside the zone, never stretched, centred
    const s = Math.min(W / logo.width, LOGO_H / logo.height, 1e9);
    const w = logo.width * s, h = logo.height * s;
    page.drawImage(logo, { x: M + (W - w) / 2, y: zoneY + (LOGO_H - h) / 2, width: w, height: h });
    return;
  }
  // typographic lockup: the event name, letterspaced, with a short teal rule beneath
  const size = fitSize(f.bold, eventName.toUpperCase(), W, 40, 14, 2.2);
  const text = eventName.toUpperCase();
  const tw = widthTracked(f.bold, text, size, 2.2);
  const cy = zoneY + LOGO_H / 2;
  drawTracked(page, f.bold, text, M + (W - tw) / 2, cy - size * 0.3, size, 2.2, NAVY);
  page.drawLine({ start: { x: PAGE_W / 2 - 18, y: cy - size * 0.3 - 14 }, end: { x: PAGE_W / 2 + 18, y: cy - size * 0.3 - 14 }, thickness: 2, color: TEAL });
}

/** The big line. Returns the baseline y of the last line drawn. */
function drawTitle(page: PDFPage, f: Fonts, p: SignPage): number {
  const top = RULE_Y - 46;
  const { text, arrow } = splitArrow(p.title);
  const arrowRoom = arrow === "→" || arrow === "←" ? 70 : 0;
  const maxW = W - arrowRoom;
  // shrink until one line fits; below 60 pt allow two lines
  let size = 96, lines = [text];
  while (size > 60 && f.xbold.widthOfTextAtSize(text, size) > maxW) size -= 2;
  if (f.xbold.widthOfTextAtSize(text, size) > maxW) {
    size = 60;
    lines = wrap(f.xbold, text, size, maxW);
    while (lines.length > 2 && size > 40) { size -= 2; lines = wrap(f.xbold, text, size, maxW); }
  }
  const lineH = size * 1.06;
  let y = top - size;
  const blockW = Math.max(...lines.map((l) => f.xbold.widthOfTextAtSize(l, size)));
  const x0 = arrow === "←" ? M + arrowRoom + (maxW - blockW) / 2 : M + (maxW - blockW) / 2;
  for (const line of lines) {
    const lw = f.xbold.widthOfTextAtSize(line, size);
    page.drawText(line, { x: x0 + (blockW - lw) / 2, y, size, font: f.xbold, color: NAVY });
    y -= lineH;
  }
  y += lineH; // baseline of last line
  if (arrow) drawArrow(page, arrow, x0, blockW, y + size * 0.36, size, lines.length);
  return y;
}

function drawSubtitle(page: PDFPage, f: Fonts, p: SignPage, eventName: string, dates: string, lastBaseline: number): number {
  let y = lastBaseline - 30;
  if (p.title.trim().toLowerCase() !== p.realName.trim().toLowerCase()) {
    const size = 20;
    const t = p.realName;
    page.drawText(t, { x: M + (W - f.medium.widthOfTextAtSize(t, size)) / 2, y, size, font: f.medium, color: SLATE });
    y -= 34;
  } else {
    y -= 4;
  }
  const size = 15;
  const line = `${eventName}  ·  ${dates}`;
  const lines = wrap(f.medium, line, size, W);
  for (const l of lines) {
    page.drawText(l, { x: M + (W - f.medium.widthOfTextAtSize(l, size)) / 2, y, size, font: f.medium, color: NAVY, opacity: 0.8 });
    y -= size * 1.35;
  }
  return y;
}

function drawStaffBlock(page: PDFPage, f: Fonts, p: SignPage, fromY: number) {
  const parts: { label: string; text: string; tone: RGB }[] = [];
  if (p.dayLabel) parts.push({ label: "Day", text: p.dayLabel, tone: NAVY });
  if (p.setupLine) parts.push({ label: "Setup", text: p.setupLine, tone: NAVY });
  if (p.notes) parts.push({ label: "Notes for the crew", text: p.notes, tone: SLATE });
  if (p.staffNotes) parts.push({ label: "Staff note", text: p.staffNotes, tone: SLATE });
  const x = M + INSET_W + 24, w = PAGE_W - M - x;
  const top = fromY - 22;
  const bottom = FOOT_RULE_Y + 16;
  const boxH = top - bottom;
  // measure first: drop to a smaller size when the crew wrote a lot
  const need = (size: number) => parts.reduce((h, part) => h + 14 + wrap(f.medium, part.text, size, w - 32).length * (size + 3.5) + 8, 40);
  const size = need(11.5) <= boxH - 12 ? 11.5 : need(10.5) <= boxH - 12 ? 10.5 : 9.5;
  page.drawRectangle({ x, y: bottom, width: w, height: boxH, color: rgb(0.965, 0.972, 0.98), borderColor: RULE, borderWidth: 0.75 });
  page.drawRectangle({ x, y: bottom, width: 4, height: boxH, color: TEAL });
  drawTracked(page, f.bold, "STAFF COPY", x + 16, top - 18, 8, 1.2, TEAL);
  let y = top - 40;
  if (!parts.length) {
    page.drawText("No setup or notes on this room yet.", { x: x + 16, y, size: 11, font: f.medium, color: SLATE });
    return;
  }
  for (const part of parts) {
    if (y < bottom + 16) break;
    page.drawText(part.label.toUpperCase(), { x: x + 16, y, size: 7.5, font: f.bold, color: SLATE });
    y -= 14;
    const lines = wrap(f.medium, part.text, size, w - 32);
    for (const l of lines) {
      if (y < bottom + 8) break;
      page.drawText(l, { x: x + 16, y, size, font: f.medium, color: part.tone });
      y -= size + 3.5;
    }
    y -= 8;
  }
}

/** Floor-plan inset: the level's outline and every room, this room in teal. */
function drawInset(page: PDFPage, f: Fonts, level: "lower" | "upper", roomId: string) {
  const L = MAP_GEOMETRY[level];
  const xs = L.outline.map((p) => p[0]), ys = L.outline.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const s = Math.min(INSET_W / (x1 - x0), INSET_H / (y1 - y0));
  const planW = (x1 - x0) * s, planH = (y1 - y0) * s;
  // drawSvgPath takes SVG space: origin at (x, y) on the page, y growing downward — the map's own convention
  const originX = M + (INSET_W - planW) / 2;
  const originY = INSET_Y + INSET_H - (INSET_H - planH) / 2;
  const path = (pts: number[][]) => pts.map((p, i) => `${i ? "L" : "M"}${((p[0] - x0) * s).toFixed(2)} ${((p[1] - y0) * s).toFixed(2)}`).join(" ") + " Z";
  const opts = { x: originX, y: originY };
  for (const r of L.rooms) {
    const target = r.id === roomId;
    page.drawSvgPath(path(r.poly), { ...opts, color: target ? TEAL : PLAN_FILL, borderColor: target ? rgb(1, 1, 1) : PLAN_LINE, borderWidth: target ? 0.8 : 0.35 });
    if (r.hole) page.drawSvgPath(path(r.hole), { ...opts, color: rgb(1, 1, 1), borderColor: PLAN_LINE, borderWidth: 0.35 });
  }
  page.drawSvgPath(path(L.outline), { ...opts, borderColor: NAVY, borderWidth: 1.2 });
  const cap = level === "lower" ? "LOWER LEVEL" : "UPPER LEVEL";
  drawTracked(page, f.bold, cap, M, INSET_Y - 14, 7.5, 1.4, SLATE);
}

function drawQr(page: PDFPage, f: Fonts, url: string) {
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const cell = QR_SIZE / n;
  const x0 = PAGE_W - M - QR_SIZE, y0 = QR_Y;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.modules.get(r, c)) continue;
      page.drawRectangle({ x: x0 + c * cell, y: y0 + (n - 1 - r) * cell, width: cell + 0.15, height: cell + 0.15, color: NAVY });
    }
  }
  const cap = "SCAN FOR THE EVENT MAP";
  const cw = widthTracked(f.bold, cap, 7.5, 1.4);
  drawTracked(page, f.bold, cap, x0 + (QR_SIZE - cw) / 2, y0 - 14, 7.5, 1.4, SLATE);
}

function drawFooter(page: PDFPage, f: Fonts, wordmark: PDFImage, datesShort: string, job: SignJob, p: SignPage) {
  page.drawLine({ start: { x: M, y: FOOT_RULE_Y }, end: { x: PAGE_W - M, y: FOOT_RULE_Y }, thickness: 0.75, color: RULE });
  const h = 22, w = h * WORDMARK_ASPECT;
  page.drawImage(wordmark, { x: M, y: FOOT_RULE_Y - 16 - h, width: w, height: h });
  page.drawText("Brainerd Baptist Church", { x: M + w + 12, y: FOOT_RULE_Y - 16 - h + 7, size: 9, font: f.medium, color: SLATE });
  const right = datesShort;
  page.drawText(right, { x: PAGE_W - M - f.medium.widthOfTextAtSize(right, 10.5), y: FOOT_RULE_Y - 16 - h + 7, size: 10.5, font: f.medium, color: NAVY });
  const gen = (job.generatedAt ?? new Date()).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const tiny = `Sign template v${TEMPLATE_VERSION} · ${job.variant === "staff" ? "staff copy · " : ""}${p.realName} · generated ${gen}${job.bookingNumber ? ` · ${job.bookingNumber}` : ""}`;
  page.drawText(tiny, { x: M, y: 46, size: 6, font: f.medium, color: rgb(0.62, 0.65, 0.7) });
}

// ── arrows for wayfinding notes ───────────────────────────────────────────

function splitArrow(title: string): { text: string; arrow: "→" | "←" | "↑" | "↓" | null } {
  const m = title.trim().match(/^(→|←|↑|↓|->|<-)\s*(.*)$|^(.*?)\s*(→|←|↑|↓|->|<-)$/);
  if (!m) return { text: title.trim(), arrow: null };
  const raw = (m[1] ?? m[4]) as string;
  const text = ((m[2] ?? m[3]) as string).trim();
  const arrow = raw === "->" ? "→" : raw === "<-" ? "←" : (raw as "→" | "←" | "↑" | "↓");
  return { text: text || title.trim(), arrow };
}

function drawArrow(page: PDFPage, arrow: string, x0: number, blockW: number, midY: number, size: number, nLines: number) {
  const len = 52, t = Math.max(7, size * 0.11), head = 20;
  const cy = nLines > 1 ? midY + size * 0.55 : midY;
  if (arrow === "→" || arrow === "←") {
    const dir = arrow === "→" ? 1 : -1;
    const xs = arrow === "→" ? x0 + blockW + 20 : x0 - 20;
    const xe = xs + dir * len;
    page.drawLine({ start: { x: xs, y: cy }, end: { x: xe - dir * head * 0.5, y: cy }, thickness: t, color: TEAL, lineCap: 1 });
    // head as a local path with its tip at the origin (SVG space, y down)
    page.drawSvgPath(`M0 0 L${-dir * head} ${-head * 0.75} L${-dir * head} ${head * 0.75} Z`, { x: xe, y: cy, color: TEAL });
  } else {
    const dir = arrow === "↑" ? 1 : -1;
    const cx = PAGE_W / 2;
    const ys = arrow === "↑" ? midY + size * 1.15 : midY - size * 0.5;
    const ye = ys + dir * len;
    page.drawLine({ start: { x: cx, y: ys }, end: { x: cx, y: ye - dir * head * 0.5 }, thickness: t, color: TEAL, lineCap: 1 });
    // in SVG space "up" on the page is negative y
    page.drawSvgPath(`M0 0 L${-head * 0.75} ${dir * head} L${head * 0.75} ${dir * head} Z`, { x: cx, y: ye, color: TEAL });
  }
}

// ── text helpers ──────────────────────────────────────────────────────────

function b64(s: string): Uint8Array {
  return Uint8Array.from(Buffer.from(s, "base64"));
}

function wrap(font: PDFFont, text: string, size: number, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= maxW || !cur) cur = next;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

function widthTracked(font: PDFFont, text: string, size: number, tracking: number): number {
  return font.widthOfTextAtSize(text, size) + tracking * Math.max(0, text.length - 1);
}

function drawTracked(page: PDFPage, font: PDFFont, text: string, x: number, y: number, size: number, tracking: number, color: RGB) {
  let cx = x;
  for (const ch of text) {
    page.drawText(ch, { x: cx, y, size, font, color });
    cx += font.widthOfTextAtSize(ch, size) + tracking;
  }
}

function fitSize(font: PDFFont, text: string, maxW: number, start: number, min: number, tracking = 0): number {
  let s = start;
  while (s > min && widthTracked(font, text, s, tracking) > maxW) s -= 1;
  return s;
}

/** "Wednesday, October 21, 2026" / "Oct 21, 2026"; ranges collapse within a month. */
export function formatDates(iso: string[]): { long: string; short: string } {
  const ds = [...new Set(iso)].sort().map((d) => { const [y, m, dd] = d.split("-").map(Number); return new Date(y, m - 1, dd); });
  if (!ds.length) return { long: "", short: "" };
  const L = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-US", o);
  if (ds.length === 1) {
    return { long: L(ds[0], { weekday: "long", month: "long", day: "numeric", year: "numeric" }), short: L(ds[0], { month: "short", day: "numeric", year: "numeric" }) };
  }
  const a = ds[0], b = ds[ds.length - 1];
  const sameMonth = a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  const long = sameMonth
    ? `${L(a, { month: "long", day: "numeric" })}–${b.getDate()}, ${b.getFullYear()}`
    : `${L(a, { month: "long", day: "numeric" })} – ${L(b, { month: "long", day: "numeric", year: "numeric" })}`;
  const short = sameMonth
    ? `${L(a, { month: "short", day: "numeric" })}–${b.getDate()}, ${b.getFullYear()}`
    : `${L(a, { month: "short", day: "numeric" })} – ${L(b, { month: "short", day: "numeric", year: "numeric" })}`;
  return { long, short };
}
