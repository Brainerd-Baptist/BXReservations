// Shared bits for the PDF outputs (packet; signs and the sheet keep their own copies for now).
import { PDFDocument, PDFFont, PDFPage, rgb, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { ARCHIVO_BOLD_B64, ARCHIVO_MEDIUM_B64, ARCHIVO_XBOLD_B64, WORDMARK_ASPECT, WORDMARK_PNG_B64 } from "./assets";

export const NAVY = rgb(0, 0.125, 0.357);
export const TEAL = rgb(0, 0.671, 0.788);
export const TEAL_SOFT = rgb(0.85, 0.94, 0.96);
export const SLATE = rgb(0.42, 0.447, 0.502);
export const RULE = rgb(0.85, 0.87, 0.9);
export const PLAN_FILL = rgb(0.933, 0.945, 0.96);
export const PLAN_LINE = rgb(0.72, 0.76, 0.81);
export const RR_FILL = rgb(0.93, 0.9, 0.96);
export const ENTRY = rgb(0.13, 0.55, 0.3);

export interface Fonts { medium: PDFFont; bold: PDFFont; xbold: PDFFont }

export const b64 = (s: string): Uint8Array => Uint8Array.from(Buffer.from(s, "base64"));

export async function newDoc(title: string, producer: string): Promise<{ pdf: PDFDocument; fonts: Fonts; wordmark: { image: Awaited<ReturnType<PDFDocument["embedPng"]>>; aspect: number } }> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(title);
  pdf.setAuthor("BX Reservations · Brainerd Baptist Church");
  pdf.setProducer(producer);
  const fonts: Fonts = {
    medium: await pdf.embedFont(b64(ARCHIVO_MEDIUM_B64), { subset: true }),
    bold: await pdf.embedFont(b64(ARCHIVO_BOLD_B64), { subset: true }),
    xbold: await pdf.embedFont(b64(ARCHIVO_XBOLD_B64), { subset: true }),
  };
  const wordmark = { image: await pdf.embedPng(b64(WORDMARK_PNG_B64)), aspect: WORDMARK_ASPECT };
  return { pdf, fonts, wordmark };
}

export function wrap(font: PDFFont, text: string, size: number, maxW: number): string[] {
  const out: string[] = [];
  for (const para of String(text ?? "").split(/\n+/)) {
    let cur = "";
    for (const w of para.split(/\s+/).filter(Boolean)) {
      const n = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(n, size) <= maxW || !cur) cur = n;
      else { out.push(cur); cur = w; }
    }
    if (cur) out.push(cur);
  }
  return out;
}

export function fit(font: PDFFont, text: string, maxW: number, start: number, min: number): number {
  let s = start;
  while (s > min && font.widthOfTextAtSize(text, s) > maxW) s -= 1;
  return s;
}

export function tracked(page: PDFPage, font: PDFFont, text: string, x: number, y: number, size: number, tracking: number, color: RGB) {
  let cx = x;
  for (const ch of text) { page.drawText(ch, { x: cx, y, size, font, color }); cx += font.widthOfTextAtSize(ch, size) + tracking; }
}

export function trackedWidth(font: PDFFont, text: string, size: number, tracking: number): number {
  return font.widthOfTextAtSize(text, size) + tracking * Math.max(0, text.length - 1);
}

/** "8:00 AM" from "08:00". */
export function fmtTime(t?: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  if (!Number.isFinite(h)) return t;
  const ap = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hh}:${String(m).padStart(2, "0")} ${ap}` : `${hh} ${ap}`;
}

export function localDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
