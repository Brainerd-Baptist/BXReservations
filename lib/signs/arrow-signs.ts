// Directional (arrow) signs — letter landscape, one page per room × direction.
//
// For entrances, hallways and stairwells. We print every direction for every
// room (left, right, straight ahead, stairs up, stairs down); staff print the
// pages they need. Same locked look as the door signs: navy + teal, Archivo,
// the renter's logo when approved, otherwise the event name.

import { PDFDocument, PDFImage, PDFPage, degrees, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { ARCHIVO_BOLD_B64, ARCHIVO_MEDIUM_B64, ARCHIVO_XBOLD_B64, WORDMARK_ASPECT, WORDMARK_PNG_B64 } from "./assets";
import type { SignPage } from "./door-signs";
import { fit, wrap } from "./pdf-common";

const W = 792, H = 612, M = 44;
const NAVY = rgb(0, 0.125, 0.357);
const TEAL = rgb(0, 0.671, 0.788);
const SLATE = rgb(0.42, 0.447, 0.502);
const RULE = rgb(0.85, 0.87, 0.9);
const b64 = (s: string) => Uint8Array.from(Buffer.from(s, "base64"));

export type Direction = "left" | "right" | "ahead" | "up" | "down";
export const DIRECTIONS: { id: Direction; caption: string }[] = [
  { id: "right", caption: "This way" },
  { id: "left", caption: "This way" },
  { id: "ahead", caption: "Straight ahead" },
  { id: "up", caption: "Stairs up" },
  { id: "down", caption: "Stairs down" },
];

// A bold block arrow pointing right, centred on (0,0), in SVG coordinates (y down).
const ARROW = "M -150 -52 L 30 -52 L 30 -130 L 170 0 L 30 130 L 30 52 L -150 52 Z";
const ROT: Record<Direction, number> = { right: 0, left: 180, ahead: -90, up: -45, down: 45 };

export interface ArrowJob {
  eventName: string;
  dates: string[];
  bookingNumber?: string | null;
  pages: SignPage[];           // room pages from buildSignPages (public variant)
  logoPng?: Buffer | Uint8Array | null;
  directions?: Direction[];    // default: all five
}

function dateLine(dates: string[]): string {
  if (!dates.length) return "";
  const f = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { ...o, timeZone: "UTC" });
  if (dates.length === 1) return f(dates[0], { weekday: "long", month: "long", day: "numeric" });
  return `${f(dates[0], { month: "long", day: "numeric" })} – ${f(dates[dates.length - 1], { month: "long", day: "numeric" })}`;
}

export async function renderArrowSigns(job: ArrowJob): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`Directional signs — ${job.eventName}`);
  pdf.setAuthor("BX Reservations · Brainerd Baptist Church");
  const medium = await pdf.embedFont(b64(ARCHIVO_MEDIUM_B64), { subset: true });
  const bold = await pdf.embedFont(b64(ARCHIVO_BOLD_B64), { subset: true });
  const xbold = await pdf.embedFont(b64(ARCHIVO_XBOLD_B64), { subset: true });
  const wordmark = await pdf.embedPng(b64(WORDMARK_PNG_B64));
  let logo: PDFImage | null = null;
  if (job.logoPng) { try { logo = await pdf.embedPng(job.logoPng); } catch { logo = null; } }

  const dirs = (job.directions?.length ? DIRECTIONS.filter((d) => job.directions!.includes(d.id)) : DIRECTIONS);
  // One set per distinct destination (room title + building name)
  const seen = new Set<string>();
  const dests = job.pages.filter((p) => p.kind === "room").filter((p) => { const k = `${p.title}|${p.realName}`; if (seen.has(k)) return false; seen.add(k); return true; });
  if (!dests.length) dests.push({ kind: "room", roomId: "", level: "lower", realName: "", title: job.eventName } as SignPage);

  const when = dateLine(job.dates);
  for (const dest of dests) {
    for (const d of dirs) {
      const page: PDFPage = pdf.addPage([W, H]);
      // Top: logo (or event name) left, date right
      const topY = H - M;
      if (logo) {
        const aspect = logo.width / logo.height;
        const lw = Math.min(260, aspect * 70), lh = lw / aspect;
        page.drawImage(logo, { x: M, y: topY - lh, width: lw, height: lh });
      } else {
        const s = fit(xbold, job.eventName, 430, 30, 16);
        page.drawText(job.eventName, { x: M, y: topY - s, size: s, font: xbold, color: NAVY });
      }
      if (when) page.drawText(when, { x: W - M - medium.widthOfTextAtSize(when, 13), y: topY - 18, size: 13, font: medium, color: SLATE });
      page.drawLine({ start: { x: M, y: topY - 86 }, end: { x: W - M, y: topY - 86 }, thickness: 1, color: RULE });

      // Arrow on the left two-thirds, destination text on the right
      const ax = d.id === "left" ? W - M - 175 : M + 175;
      const ay = 270;
      page.drawSvgPath(ARROW, { x: ax, y: ay, color: TEAL, rotate: degrees(-ROT[d.id]), scale: 0.85 });

      const tx = d.id === "left" ? M : M + 400;
      const tw = W - M - 400 - M;
      page.drawText(d.caption.toUpperCase(), { x: tx, y: 372, size: 16, font: bold, color: SLATE });
      let y = 330;
      const title = dest.title || job.eventName;
      const ts = fit(xbold, title, tw, 44, 22);
      for (const line of wrap(xbold, title, ts, tw).slice(0, 3)) {
        page.drawText(line, { x: tx, y, size: ts, font: xbold, color: NAVY });
        y -= ts + 6;
      }
      if (dest.realName && dest.realName !== title) {
        page.drawText(dest.realName, { x: tx, y: y - 6, size: 18, font: medium, color: SLATE });
        y -= 30;
      }
      if (dest.level) page.drawText(dest.level === "upper" ? "Upper level" : "Lower level", { x: tx, y: y - 12, size: 13, font: bold, color: TEAL });

      // Footer
      page.drawLine({ start: { x: M, y: 70 }, end: { x: W - M, y: 70 }, thickness: 1, color: RULE });
      const wh = 22;
      page.drawImage(wordmark, { x: M, y: 38, width: wh * WORDMARK_ASPECT, height: wh });
      const foot = `${job.bookingNumber ? `${job.bookingNumber} · ` : ""}${d.caption}`;
      page.drawText(foot, { x: W - M - medium.widthOfTextAtSize(foot, 9), y: 44, size: 9, font: medium, color: SLATE });
    }
  }
  return pdf.save();
}
