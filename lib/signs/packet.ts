// Attendee packet — what a planner sends ahead of the event: cover, getting
// here, schedule and rooms, and a full-page map of each level with every room
// for the event labeled with the event's own names. Same type and colour as
// the signs; the renter's logo is the only variable.

import { PDFPage, degrees, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { MAP_GEOMETRY, MAP_ROOMS } from "@/app/bx-map/map-bundle";
import { RESERVATION_ROOM_TO_MAP, reservationDates, reservedMapRoomIds, type MapLabel } from "@/lib/event-map";
import type { VenueInfo } from "@/lib/venue";
import { formatDates, TEMPLATE_VERSION } from "./door-signs";
import { CAMPUS_MAP_BX_BOX, CAMPUS_MAP_PDF_B64 } from "./assets";
import { ENTRY, NAVY, PLAN_FILL, PLAN_LINE, RR_FILL, RULE, SLATE, TEAL, TEAL_SOFT, b64, fit, fmtTime, localDate, newDoc, tracked, trackedWidth, wrap, type Fonts } from "./pdf-common";

export interface PacketJob {
  eventName: string;
  bookingNumber?: string | null;
  payload: unknown;
  labels: MapLabel[];       // public labels (no staff notes)
  venue: VenueInfo;
  logoPng?: Buffer | Uint8Array | null;
  /** Absolute URL of the shared event map, or null when sharing is off. */
  shareUrl: string | null;
  generatedAt?: Date;
}

interface PayloadDay { date?: string; included?: boolean; customStart?: string; customEnd?: string; headcount?: number; rooms?: { roomId?: string }[] }

const P = { w: 612, h: 792, m: 54 };
const L = { w: 792, h: 612, m: 44 }; // map pages, landscape

export async function renderPacket(job: PacketJob): Promise<Uint8Array> {
  const { pdf, fonts, wordmark } = await newDoc(`${job.eventName} — event packet`, `BX event packet v${TEMPLATE_VERSION}`);
  const logo = job.logoPng ? await pdf.embedPng(job.logoPng) : null;
  const dates = reservationDates(job.payload);
  const dateText = formatDates(dates);
  const days = ((job.payload as { days?: PayloadDay[] } | null)?.days ?? [])
    .filter((d) => d && d.date && d.included !== false)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const reserved = new Set(reservedMapRoomIds(job.payload));
  const base = (id: string) => job.labels.find((l) => l.room_id === id && l.day_index === null);
  const nameOf = (id: string) => base(id)?.event_name?.trim() || MAP_ROOMS.find((r) => r.id === id)?.name || id;
  const mainOf = (catalogueId: string) => RESERVATION_ROOM_TO_MAP[catalogueId]?.[0];
  const gen = (job.generatedAt ?? new Date()).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  let pageNo = 0;

  const footer = (page: PDFPage, w: number, m: number) => {
    pageNo += 1;
    const y = 40;
    page.drawLine({ start: { x: m, y: y + 22 }, end: { x: w - m, y: y + 22 }, thickness: 0.5, color: RULE });
    const h = 13, ww = h * wordmark.aspect;
    page.drawImage(wordmark.image, { x: m, y, width: ww, height: h });
    page.drawText("Brainerd Baptist Church", { x: m + ww + 10, y: y + 3, size: 8.5, font: fonts.medium, color: SLATE });
    const right = `${job.eventName}  ·  ${dateText.short}  ·  ${pageNo}`;
    page.drawText(right, { x: w - m - fonts.medium.widthOfTextAtSize(right, 8.5), y: y + 3, size: 8.5, font: fonts.medium, color: SLATE });
    const tiny = `Event packet v${TEMPLATE_VERSION} · generated ${gen}${job.bookingNumber ? ` · ${job.bookingNumber}` : ""}`;
    page.drawText(tiny, { x: m, y: y - 12, size: 6, font: fonts.medium, color: rgb(0.62, 0.65, 0.7) });
  };

  // ── 1. cover ──────────────────────────────────────────────────────────
  {
    const page = pdf.addPage([P.w, P.h]);
    const W = P.w - P.m * 2;
    const zoneTop = P.h - P.m, zoneH = 150;
    if (logo) {
      const s = Math.min(W / logo.width, zoneH / logo.height);
      const w = logo.width * s, h = logo.height * s;
      page.drawImage(logo, { x: P.m + (W - w) / 2, y: zoneTop - zoneH + (zoneH - h) / 2, width: w, height: h });
    }
    let y = zoneTop - zoneH - 40;
    tracked(page, fonts.bold, "WELCOME TO", P.m + (W - trackedWidth(fonts.bold, "WELCOME TO", 10, 2.2)) / 2, y, 10, 2.2, TEAL);
    y -= 14;
    let size = 56, lines = [job.eventName];
    while (size > 34 && fonts.xbold.widthOfTextAtSize(job.eventName, size) > W) size -= 2;
    if (fonts.xbold.widthOfTextAtSize(job.eventName, size) > W) { size = 34; lines = wrap(fonts.xbold, job.eventName, size, W); }
    for (const l of lines) { y -= size; page.drawText(l, { x: P.m + (W - fonts.xbold.widthOfTextAtSize(l, size)) / 2, y, size, font: fonts.xbold, color: NAVY }); y -= 6; }
    y -= 14;
    page.drawText(dateText.long, { x: P.m + (W - fonts.medium.widthOfTextAtSize(dateText.long, 16)) / 2, y, size: 16, font: fonts.medium, color: NAVY });
    y -= 22;
    if (days.length === 1 && days[0].customStart && days[0].customEnd) {
      const t = `${fmtTime(days[0].customStart)} – ${fmtTime(days[0].customEnd)}`;
      page.drawText(t, { x: P.m + (W - fonts.medium.widthOfTextAtSize(t, 13)) / 2, y, size: 13, font: fonts.medium, color: SLATE });
      y -= 20;
    }
    y -= 10;
    page.drawLine({ start: { x: P.w / 2 - 18, y }, end: { x: P.w / 2 + 18, y }, thickness: 2, color: TEAL });
    y -= 26;
    page.drawText(job.venue.venue_name, { x: P.m + (W - fonts.bold.widthOfTextAtSize(job.venue.venue_name, 13)) / 2, y, size: 13, font: fonts.bold, color: NAVY });
    y -= 17;
    for (const l of wrap(fonts.medium, job.venue.venue_address, 11.5, W)) {
      page.drawText(l, { x: P.m + (W - fonts.medium.widthOfTextAtSize(l, 11.5)) / 2, y, size: 11.5, font: fonts.medium, color: SLATE });
      y -= 15;
    }
    // your event map — QR + link
    if (job.shareUrl) {
      const qrSize = 104, qy = 120, qx = P.w / 2 - qrSize / 2;
      drawQr(page, job.shareUrl, qx, qy, qrSize);
      const cap = "YOUR EVENT MAP";
      tracked(page, fonts.bold, cap, P.w / 2 - trackedWidth(fonts.bold, cap, 8, 1.6) / 2, qy + qrSize + 12, 8, 1.6, SLATE);
      const link = job.shareUrl.replace(/^https?:\/\//, "");
      const ls = fit(fonts.medium, link, W, 9, 6.5);
      page.drawText(link, { x: P.w / 2 - fonts.medium.widthOfTextAtSize(link, ls) / 2, y: qy - 16, size: ls, font: fonts.medium, color: TEAL });
      const sub = "Scan or open the link on the day to see every room for this event, with restrooms and exits.";
      page.drawText(sub, { x: P.w / 2 - fonts.medium.widthOfTextAtSize(sub, 8.5) / 2, y: qy - 30, size: 8.5, font: fonts.medium, color: SLATE });
    }
    footer(page, P.w, P.m);
  }

  // ── 2. getting here ───────────────────────────────────────────────────
  {
    const page = pdf.addPage([P.w, P.h]);
    const W = P.w - P.m * 2;
    let y = P.h - P.m;
    tracked(page, fonts.bold, "GETTING HERE", P.m, y - 8, 9, 2, TEAL);
    y -= 34;
    page.drawText(job.venue.venue_name, { x: P.m, y, size: 22, font: fonts.xbold, color: NAVY });
    y -= 22;
    const colW = job.venue.venue_maps_url ? W - 140 : W;
    for (const l of wrap(fonts.medium, job.venue.venue_address, 12, colW)) { page.drawText(l, { x: P.m, y, size: 12, font: fonts.medium, color: SLATE }); y -= 16; }
    if (job.venue.venue_maps_url) {
      const qs = 96;
      drawQr(page, job.venue.venue_maps_url, P.w - P.m - qs, P.h - P.m - 30 - qs, qs);
      const cap = "DIRECTIONS";
      tracked(page, fonts.bold, cap, P.w - P.m - qs + (qs - trackedWidth(fonts.bold, cap, 7.5, 1.4)) / 2, P.h - P.m - 30 - qs - 14, 7.5, 1.4, SLATE);
      y = Math.min(y, P.h - P.m - 30 - qs - 34);
    }
    y -= 8;
    const section = (title: string, body: string) => {
      if (!body) return;
      page.drawLine({ start: { x: P.m, y: y + 6 }, end: { x: P.w - P.m, y: y + 6 }, thickness: 0.5, color: RULE });
      y -= 16;
      page.drawText(title, { x: P.m, y, size: 13, font: fonts.bold, color: NAVY });
      y -= 18;
      for (const l of wrap(fonts.medium, body, 11, W)) { page.drawText(l, { x: P.m, y, size: 11, font: fonts.medium, color: SLATE }); y -= 15; }
      y -= 10;
    };
    section("Parking", job.venue.venue_parking);
    section("When you arrive", job.venue.venue_arrival);
    // entrances come from the map itself: the doors it marks as main entrances, on both levels
    const clean = (n: string) => n.replace(/,\s*[a-zé]+ doors/i, "");
    const entrances: string[] = [];
    for (const level of ["lower", "upper"] as const) {
      for (const e of MAP_GEOMETRY[level].exits.filter((x) => x.primary)) {
        const line = `${clean(e.name)} — ${level} level`;
        if (!entrances.includes(line)) entrances.push(line);
      }
    }
    section("Entrances", entrances.map((e) => `• ${e}`).join("\n") + "\n• The elevator between levels is at the Green Lot entrance.");
    if (job.venue.venue_contact) section("On the day", `Questions on the day: ${job.venue.venue_contact}`);
    footer(page, P.w, P.m);
  }

  // ── 2b. campus map — the church's own map, the BX highlighted ─────────
  {
    const [campus] = await pdf.embedPdf(b64(CAMPUS_MAP_PDF_B64), [0]);
    const page = pdf.addPage([L.w, L.h]);
    page.drawPage(campus, { x: 0, y: 0, width: L.w, height: L.h });
    const [bx, by, bw, bh] = CAMPUS_MAP_BX_BOX;
    const r = 10;
    const rounded = `M${r} 0 H${bw - r} A${r} ${r} 0 0 1 ${bw} ${r} V${bh - r} A${r} ${r} 0 0 1 ${bw - r} ${bh} H${r} A${r} ${r} 0 0 1 0 ${bh - r} V${r} A${r} ${r} 0 0 1 ${r} 0 Z`;
    page.drawSvgPath(rounded, { x: bx, y: by + bh, borderColor: TEAL, borderWidth: 3 });
    // caption pill above the box
    const cap = `${job.eventName} is here`;
    const cs = fit(fonts.bold, cap, 260, 11, 8);
    const cw = fonts.bold.widthOfTextAtSize(cap, cs) + 20;
    const cx = Math.min(L.w - 16 - cw, Math.max(16, bx + bw / 2 - cw / 2));
    page.drawRectangle({ x: cx, y: by + bh + 10, width: cw, height: 22, color: TEAL, borderColor: rgb(1, 1, 1), borderWidth: 1.5 });
    page.drawText(cap, { x: cx + 10, y: by + bh + 16.5, size: cs, font: fonts.bold, color: rgb(1, 1, 1) });
    // strip: what to know, on the map's own terms
    const note = job.venue.venue_parking || "The BX is the separate building on Austin St. The lots beside it are the Green Lot (Austin St.), the Pink Lot (by the soccer field) and the Blue Lot (along Mayfair Ave.).";
    page.drawRectangle({ x: 0, y: 0, width: L.w, height: 34, color: rgb(1, 1, 1), opacity: 0.92 });
    const nl = wrap(fonts.medium, note, 9.5, L.w - 2 * L.m - 120);
    page.drawText(nl[0], { x: L.m, y: 20, size: 9.5, font: fonts.medium, color: NAVY });
    if (nl[1]) page.drawText(nl[1], { x: L.m, y: 8, size: 9.5, font: fonts.medium, color: NAVY });
    const pg = `Campus map · ${job.eventName}`;
    page.drawText(pg, { x: L.w - L.m - fonts.medium.widthOfTextAtSize(pg, 8.5), y: 14, size: 8.5, font: fonts.medium, color: SLATE });
    pageNo += 1;
  }

  // ── 3. schedule and rooms ─────────────────────────────────────────────
  {
    const page = pdf.addPage([P.w, P.h]);
    const W = P.w - P.m * 2;
    let y = P.h - P.m;
    tracked(page, fonts.bold, "YOUR SCHEDULE AND ROOMS", P.m, y - 8, 9, 2, TEAL);
    y -= 34;
    page.drawText(job.eventName, { x: P.m, y, size: 22, font: fonts.xbold, color: NAVY });
    y -= 26;
    for (const d of days) {
      if (y < 130) break;
      const title = localDate(d.date!).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
      const hours = d.customStart && d.customEnd ? `${fmtTime(d.customStart)} – ${fmtTime(d.customEnd)}` : "";
      page.drawText(title, { x: P.m, y, size: 14, font: fonts.bold, color: NAVY });
      if (hours) page.drawText(hours, { x: P.m + fonts.bold.widthOfTextAtSize(title, 14) + 10, y, size: 12, font: fonts.medium, color: SLATE });
      y -= 8;
      page.drawLine({ start: { x: P.m, y }, end: { x: P.w - P.m, y }, thickness: 0.5, color: RULE });
      y -= 18;
      const ids = [...new Set((d.rooms ?? []).map((r) => mainOf(r.roomId ?? "")).filter(Boolean))] as string[];
      // sub-spaces the planner named (stage, balcony) ride along under their main room
      for (const id of ids) {
        const room = MAP_ROOMS.find((r) => r.id === id);
        if (!room) continue;
        const nm = nameOf(id);
        page.drawText(nm, { x: P.m + 4, y, size: 12.5, font: fonts.bold, color: NAVY });
        const sub = `${nm !== room.name ? `${room.name} · ` : ""}${room.level === "lower" ? "Lower level" : "Upper level"}`;
        page.drawText(sub, { x: P.m + 4 + fonts.bold.widthOfTextAtSize(nm, 12.5) + 8, y, size: 10, font: fonts.medium, color: SLATE });
        y -= 17;
        const subs = (RESERVATION_ROOM_TO_MAP[(d.rooms ?? []).find((r) => mainOf(r.roomId ?? "") === id)?.roomId ?? ""] ?? []).slice(1).filter((sid) => base(sid)?.event_name);
        for (const sid of subs) {
          const sr = MAP_ROOMS.find((r) => r.id === sid);
          page.drawText(`${nameOf(sid)}  ·  ${sr?.name ?? sid}`, { x: P.m + 18, y, size: 10.5, font: fonts.medium, color: SLATE });
          y -= 15;
        }
      }
      y -= 12;
    }
    const wayfinding = MAP_ROOMS.filter((r) => !reserved.has(r.id) && base(r.id)?.event_name?.trim());
    if (wayfinding.length && y > 120) {
      page.drawText("Look for", { x: P.m, y, size: 14, font: fonts.bold, color: NAVY });
      y -= 8;
      page.drawLine({ start: { x: P.m, y }, end: { x: P.w - P.m, y }, thickness: 0.5, color: RULE });
      y -= 18;
      for (const r of wayfinding) {
        if (y < 100) break;
        page.drawText(base(r.id)!.event_name!.trim(), { x: P.m + 4, y, size: 12, font: fonts.bold, color: NAVY });
        page.drawText(`${r.name} · ${r.level === "lower" ? "Lower level" : "Upper level"}`, { x: P.m + 4 + fonts.bold.widthOfTextAtSize(base(r.id)!.event_name!.trim(), 12) + 8, y, size: 10, font: fonts.medium, color: SLATE });
        y -= 17;
      }
    }
    void W;
    footer(page, P.w, P.m);
  }

  // ── 4. one landscape map page per level that has something for this event ──
  for (const level of ["lower", "upper"] as const) {
    const G = MAP_GEOMETRY[level];
    const involved = G.rooms.filter((r) => reserved.has(r.id) || base(r.id)?.event_name);
    if (!involved.length) continue;
    const page = pdf.addPage([L.w, L.h]);
    const W = L.w - L.m * 2;
    const y = L.h - L.m;
    tracked(page, fonts.bold, level === "lower" ? "LOWER LEVEL" : "UPPER LEVEL", L.m, y - 8, 9, 2, TEAL);
    const t = `${job.eventName} — ${level === "lower" ? "lower level" : "upper level"}`;
    page.drawText(t, { x: L.m, y: y - 30, size: 18, font: fonts.xbold, color: NAVY });
    // legend
    const lg = [{ c: TEAL, t: "Your rooms" }, { c: RR_FILL, t: "Restrooms" }, { c: ENTRY, t: "Main entrance" }];
    let lx = L.w - L.m;
    for (const item of [...lg].reverse()) {
      const tw = fonts.medium.widthOfTextAtSize(item.t, 9);
      lx -= tw;
      page.drawText(item.t, { x: lx, y: y - 27, size: 9, font: fonts.medium, color: SLATE });
      lx -= 14;
      page.drawRectangle({ x: lx, y: y - 29, width: 10, height: 10, color: item.c, borderColor: PLAN_LINE, borderWidth: 0.4 });
      lx -= 16;
    }
    drawLevel(page, fonts, level, { x: L.m, y: 78, w: W, h: y - 50 - 78 }, reserved, nameOf, (id) => !!base(id)?.event_name);
    footer(page, L.w, L.m);
  }

  return pdf.save();
}

// ── level plan with labels ───────────────────────────────────────────────

function drawLevel(
  page: PDFPage,
  f: Fonts,
  level: "lower" | "upper",
  box: { x: number; y: number; w: number; h: number },
  reserved: Set<string>,
  nameOf: (id: string) => string,
  hasNote: (id: string) => boolean
) {
  const G = MAP_GEOMETRY[level];
  const xs = G.outline.map((p) => p[0]), ys = G.outline.map((p) => p[1]);
  const x0 = Math.min(...xs) - 60, x1 = Math.max(...xs) + 60, y0 = Math.min(...ys) - 60, y1 = Math.max(...ys) + 60;
  const s = Math.min(box.w / (x1 - x0), box.h / (y1 - y0));
  const planW = (x1 - x0) * s, planH = (y1 - y0) * s;
  const originX = box.x + (box.w - planW) / 2, originY = box.y + (box.h - planH) / 2 + planH; // top-left in PDF coords
  const tx = (x: number) => originX + (x - x0) * s;
  const ty = (y: number) => originY - (y - y0) * s;
  const path = (pts: number[][]) => pts.map((p, i) => `${i ? "L" : "M"}${((p[0] - x0) * s).toFixed(2)} ${((p[1] - y0) * s).toFixed(2)}`).join(" ") + " Z";
  const opts = { x: originX, y: originY };

  for (const r of G.rooms) {
    const on = reserved.has(r.id);
    const noted = !on && hasNote(r.id);
    const fill = on ? TEAL : noted ? TEAL_SOFT : r.cat === "restroom" ? RR_FILL : r.cat === "hall" ? rgb(1, 1, 1) : PLAN_FILL;
    page.drawSvgPath(path(r.poly), { ...opts, color: fill, borderColor: on ? rgb(1, 1, 1) : PLAN_LINE, borderWidth: on ? 1 : 0.4 });
    if (r.hole) page.drawSvgPath(path(r.hole), { ...opts, color: rgb(1, 1, 1), borderColor: PLAN_LINE, borderWidth: 0.4 });
  }
  page.drawSvgPath(path(G.outline), { ...opts, borderColor: NAVY, borderWidth: 2 });

  // labels: the event's names on its rooms, wayfinding notes on theirs, tiny real names on the rest of the big rooms
  for (const r of G.rooms) {
    const on = reserved.has(r.id), noted = !on && hasNote(r.id);
    const bx = r.poly.map((p) => p[0]), by = r.poly.map((p) => p[1]);
    const w = (Math.max(...bx) - Math.min(...bx)) * s, h = (Math.max(...by) - Math.min(...by)) * s;
    const [cx, cy, rot] = r.label ? [tx(r.label[0]), ty(r.label[1]), r.label[2] ?? 0] : centroid(r.poly, tx, ty);
    if (!(on || noted)) {
      if (r.cat === "restroom" && w > 14 && h > 10) { page.drawText("RR", { x: cx - f.medium.widthOfTextAtSize("RR", 5.5) / 2, y: cy - 2, size: 5.5, font: f.medium, color: rgb(0.45, 0.35, 0.6) }); }
      continue;
    }
    const text = nameOf(r.id);
    const vertical = rot !== 0 || (h > w * 1.4 && w < f.bold.widthOfTextAtSize(text, 8));
    const along = vertical ? h : w;
    let size = Math.min(16, Math.floor((along - 8) / (text.length * 0.56)));
    if (size < 6) size = 6;
    const tw = f.bold.widthOfTextAtSize(text, size);
    const color = on ? rgb(1, 1, 1) : NAVY;
    if (vertical) page.drawText(text, { x: cx + size * 0.36, y: cy - tw / 2, size, font: f.bold, color, rotate: degrees(90) });
    else page.drawText(text, { x: cx - tw / 2, y: cy - size * 0.36, size, font: f.bold, color });
    if (on && text !== (MAP_ROOMS.find((m) => m.id === r.id)?.name ?? "") && (vertical ? w : h) > size * 2.6) {
      const real = MAP_ROOMS.find((m) => m.id === r.id)!.name;
      const rs = Math.max(5, Math.min(8, size * 0.55));
      const rw = f.medium.widthOfTextAtSize(real, rs);
      if (vertical) page.drawText(real, { x: cx + size * 0.36 + rs * 1.4, y: cy - rw / 2, size: rs, font: f.medium, color: rgb(0.9, 0.97, 0.98), rotate: degrees(90) });
      else page.drawText(real, { x: cx - rw / 2, y: cy - size * 0.36 - rs * 1.25, size: rs, font: f.medium, color: rgb(0.9, 0.97, 0.98) });
    }
  }
  // main entrances
  for (const e of G.exits.filter((x) => x.primary)) {
    const px = tx(e.pt[0]), py = ty(e.pt[1]);
    const off = { n: [0, 9], s: [0, -9], e: [9, 0], w: [-9, 0] }[e.side] ?? [0, 0];
    page.drawCircle({ x: px + off[0], y: py + off[1], size: 4.5, color: ENTRY, borderColor: rgb(1, 1, 1), borderWidth: 1 });
  }
  // site context
  const cxm = tx((x0 + x1) / 2), cym = ty((y0 + y1) / 2);
  const ctx = (text: string, x: number, y: number) => {
    const tw = trackedWidth(f.bold, text, 7, 1.6);
    tracked(page, f.bold, text, x - tw / 2, y, 7, 1.6, SLATE);
  };
  ctx(level === "lower" ? "AUSTIN ST.  ·  BX ENTRANCE" : "AUSTIN ST.", cxm, ty(y0) + 6);
  ctx("SOCCER FIELD  ·  PINK LOT", cxm, ty(y1) - 12);
  page.drawText("GREEN LOT", { x: tx(x0) - 4, y: cym - 18, size: 7, font: f.bold, color: SLATE, rotate: degrees(90) });
  page.drawText("LOADING DOCK", { x: tx(x1) + 10, y: cym + 24, size: 7, font: f.bold, color: SLATE, rotate: degrees(-90) });
}

function centroid(poly: number[][], tx: (x: number) => number, ty: (y: number) => number): [number, number, number] {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
    const fct = x1 * y2 - x2 * y1;
    a += fct; cx += (x1 + x2) * fct; cy += (y1 + y2) * fct;
  }
  a *= 0.5;
  if (Math.abs(a) < 1e-6) {
    const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
    return [tx((Math.min(...xs) + Math.max(...xs)) / 2), ty((Math.min(...ys) + Math.max(...ys)) / 2), 0];
  }
  return [tx(cx / (6 * a)), ty(cy / (6 * a)), 0];
}

function drawQr(page: PDFPage, url: string, x0: number, y0: number, size: number) {
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const n = qr.modules.size, cell = size / n;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!qr.modules.get(r, c)) continue;
    page.drawRectangle({ x: x0 + c * cell, y: y0 + (n - 1 - r) * cell, width: cell + 0.15, height: cell + 0.15, color: NAVY });
  }
}
