// Setup sheet — the crew's one-page (or few-page) brief for an event:
// every reserved room with its setup, counts and notes, grouped by day, plus
// the wayfinding signs to hang. Staff only. Same type and colour as the signs.

import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { ARCHIVO_BOLD_B64, ARCHIVO_MEDIUM_B64, WORDMARK_ASPECT, WORDMARK_PNG_B64 } from "./assets";
import { MAP_GEOMETRY, MAP_ROOMS } from "@/app/bx-map/map-bundle";
import { formatDates, TEMPLATE_VERSION } from "./door-signs";
import { mainMapRooms, setupLine } from "./build-pages";
import { reservationDates, reservedMapRoomIds, type MapLabel } from "@/lib/event-map";

const PAGE_W = 612, PAGE_H = 792, M = 48, W = PAGE_W - M * 2;
const NAVY = rgb(0, 0.125, 0.357), TEAL = rgb(0, 0.671, 0.788), SLATE = rgb(0.42, 0.447, 0.502);
const RULE = rgb(0.85, 0.87, 0.9), ROW = rgb(0.965, 0.972, 0.98), PLAN_FILL = rgb(0.933, 0.945, 0.96), PLAN_LINE = rgb(0.72, 0.76, 0.81);

export interface SetupSheetJob {
  eventName: string;
  bookingNumber?: string | null;
  contactName?: string | null;
  contactOrg?: string | null;
  contactPhone?: string | null;
  payload: unknown;
  labels: MapLabel[]; // with staff_notes
  headcount?: number | null;
  generatedAt?: Date;
}

interface Row { roomId: string; level: "lower" | "upper"; realName: string; title: string; setup: string | null; notes: string | null; staff: string | null }

export async function renderSetupSheet(job: SetupSheetJob): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`${job.eventName} — setup sheet`);
  pdf.setProducer(`BX setup sheet v${TEMPLATE_VERSION}`);
  const medium = await pdf.embedFont(b64(ARCHIVO_MEDIUM_B64), { subset: true });
  const bold = await pdf.embedFont(b64(ARCHIVO_BOLD_B64), { subset: true });
  const wordmark = await pdf.embedPng(b64(WORDMARK_PNG_B64));
  const dates = reservationDates(job.payload);
  const reserved = new Set(reservedMapRoomIds(job.payload));
  const dateText = formatDates(dates);

  // rows per day (null = whole event when nothing varies)
  const varies = dates.length > 1 && job.labels.some((l) => l.day_index !== null);
  const days: (number | null)[] = varies ? dates.map((_, i) => i) : [null];
  const base = (id: string) => job.labels.find((l) => l.room_id === id && l.day_index === null);
  const forDay = (id: string, d: number | null): MapLabel | undefined => {
    const b = base(id);
    const own = d === null ? undefined : job.labels.find((l) => l.room_id === id && l.day_index === d);
    if (!own) return b;
    return { ...(b ?? own), setup_style: own.setup_style, chairs: own.chairs, tables_6ft: own.tables_6ft, tables_8ft: own.tables_8ft, tables_round: own.tables_round };
  };
  const main = mainMapRooms(job.payload);
  const rowsFor = (d: number | null): Row[] =>
    MAP_ROOMS.filter((r) => reserved.has(r.id) && (main.has(r.id) || !!base(r.id)))
      .map((r) => {
        const l = forDay(r.id, d);
        return { roomId: r.id, level: r.level, realName: r.name, title: l?.event_name?.trim() || r.name, setup: setupLine(l), notes: l?.notes ?? null, staff: l?.staff_notes ?? null };
      });
  const wayfinding = MAP_ROOMS.filter((r) => !reserved.has(r.id) && base(r.id)?.event_name?.trim()).map((r) => ({ realName: r.name, title: base(r.id)!.event_name!.trim(), notes: base(r.id)!.notes, staff: base(r.id)!.staff_notes ?? null }));

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - M;
  const newPage = () => { footer(page); page = pdf.addPage([PAGE_W, PAGE_H]); y = PAGE_H - M; };
  const need = (h: number) => { if (y - h < M + 40) newPage(); };
  const footer = (p: PDFPage) => {
    p.drawLine({ start: { x: M, y: M + 18 }, end: { x: PAGE_W - M, y: M + 18 }, thickness: 0.5, color: RULE });
    const h = 14, w = h * WORDMARK_ASPECT;
    p.drawImage(wordmark, { x: M, y: M, width: w, height: h });
    const gen = (job.generatedAt ?? new Date()).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
    const t = `Setup sheet v${TEMPLATE_VERSION} · generated ${gen}${job.bookingNumber ? ` · ${job.bookingNumber}` : ""} · page ${pdf.getPageCount()}`;
    p.drawText(t, { x: PAGE_W - M - medium.widthOfTextAtSize(t, 7), y: M + 4, size: 7, font: medium, color: SLATE });
  };

  // ── header
  tracked(page, bold, "SETUP SHEET · STAFF", M, y - 8, 8, 1.4, TEAL);
  y -= 30;
  const titleSize = fit(bold, job.eventName, W - 190, 26, 16);
  page.drawText(job.eventName, { x: M, y, size: titleSize, font: bold, color: NAVY });
  y -= 18;
  page.drawText(dateText.long, { x: M, y, size: 11, font: medium, color: NAVY, opacity: 0.85 });
  y -= 15;
  const meta = [job.bookingNumber, job.contactName, job.contactOrg, job.contactPhone, job.headcount ? `${job.headcount} expected` : null].filter(Boolean).join("  ·  ");
  for (const l of wrap(medium, meta, 9.5, W - 200)) { page.drawText(l, { x: M, y, size: 9.5, font: medium, color: SLATE }); y -= 13; }

  // level insets at top right with every reserved room in teal
  let ix = PAGE_W - M - 84;
  for (const level of ["upper", "lower"] as const) {
    if (!MAP_ROOMS.some((r) => r.level === level && reserved.has(r.id))) continue;
    inset(page, level, reserved, ix, PAGE_H - M - 8, 84, 46);
    tracked(page, bold, level.toUpperCase(), ix, PAGE_H - M - 64, 6.5, 1.2, SLATE);
    ix -= 96;
  }
  y = Math.min(y, PAGE_H - M - 76) - 10;
  page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 0.75, color: RULE });
  y -= 22;

  // ── rooms by day
  const dayName = (i: number) => { const [yy, mm, dd] = dates[i].split("-").map(Number); return new Date(yy, mm - 1, dd).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }); };
  const COLS = { room: M, setup: M + 170, notes: M + 320 };
  for (const d of days) {
    const rows = rowsFor(d);
    need(40);
    page.drawText(d === null ? (dates.length > 1 ? "Every day" : "Rooms") : dayName(d), { x: M, y, size: 13, font: bold, color: NAVY });
    y -= 16;
    tracked(page, bold, "ROOM", COLS.room, y, 7, 1.2, SLATE);
    tracked(page, bold, "SETUP", COLS.setup, y, 7, 1.2, SLATE);
    tracked(page, bold, "NOTES", COLS.notes, y, 7, 1.2, SLATE);
    y -= 6;
    page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 0.5, color: RULE });
    y -= 4;
    let alt = false;
    for (const r of rows) {
      const setupLines = wrap(medium, r.setup ?? "As-is — no setup requested", 9.5, COLS.notes - COLS.setup - 12);
      const noteLines = [...wrap(medium, r.notes ?? "", 9.5, PAGE_W - M - COLS.notes), ...(r.staff ? wrap(medium, `Staff: ${r.staff}`, 9.5, PAGE_W - M - COLS.notes) : [])].filter(Boolean);
      const lines = Math.max(2, setupLines.length, noteLines.length);
      const h = 8 + lines * 12;
      need(h + 4);
      if (alt) page.drawRectangle({ x: M, y: y - h + 6, width: W, height: h, color: ROW });
      alt = !alt;
      let ty = y - 6;
      page.drawText(r.title, { x: COLS.room + 4, y: ty, size: 10.5, font: bold, color: NAVY });
      if (r.title !== r.realName) page.drawText(r.realName, { x: COLS.room + 4, y: ty - 12, size: 8.5, font: medium, color: SLATE });
      else page.drawText(r.level === "lower" ? "Lower level" : "Upper level", { x: COLS.room + 4, y: ty - 12, size: 8.5, font: medium, color: SLATE });
      for (const l of setupLines) { page.drawText(l, { x: COLS.setup, y: ty, size: 9.5, font: medium, color: r.setup ? NAVY : SLATE }); ty -= 12; }
      ty = y - 6;
      for (const l of noteLines) { page.drawText(l, { x: COLS.notes, y: ty, size: 9.5, font: medium, color: l.startsWith("Staff:") ? TEAL : SLATE }); ty -= 12; }
      y -= h;
    }
    y -= 14;
  }

  // ── wayfinding signs to hang
  if (wayfinding.length) {
    need(40);
    page.drawText("Wayfinding signs to hang", { x: M, y, size: 13, font: bold, color: NAVY });
    y -= 18;
    for (const w of wayfinding) {
      need(26);
      page.drawText(`${w.title}`, { x: M + 4, y, size: 10.5, font: bold, color: NAVY });
      page.drawText(`at ${w.realName}${w.notes ? ` — ${w.notes}` : ""}${w.staff ? `  ·  Staff: ${w.staff}` : ""}`, { x: M + 4 + bold.widthOfTextAtSize(w.title, 10.5) + 8, y, size: 9.5, font: medium, color: SLATE });
      y -= 16;
    }
  }
  footer(page);
  return pdf.save();
}

function inset(page: PDFPage, level: "lower" | "upper", reserved: Set<string>, x: number, yTop: number, w: number, h: number) {
  const L = MAP_GEOMETRY[level];
  const xs = L.outline.map((p) => p[0]), ys = L.outline.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const s = Math.min(w / (x1 - x0), h / (y1 - y0));
  const originX = x + (w - (x1 - x0) * s) / 2, originY = yTop - (h - (y1 - y0) * s) / 2;
  const path = (pts: number[][]) => pts.map((p, i) => `${i ? "L" : "M"}${((p[0] - x0) * s).toFixed(2)} ${((p[1] - y0) * s).toFixed(2)}`).join(" ") + " Z";
  for (const r of L.rooms) {
    const on = reserved.has(r.id);
    page.drawSvgPath(path(r.poly), { x: originX, y: originY, color: on ? TEAL : PLAN_FILL, borderColor: on ? rgb(1, 1, 1) : PLAN_LINE, borderWidth: on ? 0.5 : 0.25 });
  }
  page.drawSvgPath(path(L.outline), { x: originX, y: originY, borderColor: NAVY, borderWidth: 0.8 });
}

function b64(s: string): Uint8Array { return Uint8Array.from(Buffer.from(s, "base64")); }
function wrap(font: PDFFont, text: string, size: number, maxW: number): string[] {
  if (!text) return [];
  const out: string[] = []; let cur = "";
  for (const w of text.split(/\s+/).filter(Boolean)) { const n = cur ? `${cur} ${w}` : w; if (font.widthOfTextAtSize(n, size) <= maxW || !cur) cur = n; else { out.push(cur); cur = w; } }
  if (cur) out.push(cur);
  return out;
}
function fit(font: PDFFont, text: string, maxW: number, start: number, min: number): number { let s = start; while (s > min && font.widthOfTextAtSize(text, s) > maxW) s -= 1; return s; }
function tracked(page: PDFPage, font: PDFFont, text: string, x: number, y: number, size: number, tracking: number, color: ReturnType<typeof rgb>) {
  let cx = x; for (const ch of text) { page.drawText(ch, { x: cx, y, size, font, color }); cx += font.widthOfTextAtSize(ch, size) + tracking; }
}
