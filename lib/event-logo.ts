// Event Map · Phase B — renters' logos.
//
// Flow (Vercel keeps request bodies small, so the file never passes through
// our function):
//   1. the browser asks for a signed upload URL         → POST …/logo/upload-url
//   2. the browser PUTs the file straight into storage  (private bucket)
//   3. the browser tells us it landed                    → POST …/logo
//      we download it, normalise it with sharp (trim margins, ≤2400 px,
//      transparent PNG, original kept), and set logo_status = 'pending'
//   4. a Booking Admin approves or asks for another file → PATCH …/logo
//
// The logo is shown only on that reservation's event map (once approved) and
// on its door signs. Nothing here is public: every read goes through a
// short-lived signed URL made by the server.

import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";

export const LOGO_BUCKET = "event-logos";
export const LOGO_MAX_BYTES = 10 * 1024 * 1024;
export const LOGO_MAX_PX = 2400;
/** Trimmed logos narrower than this print visibly soft on a letter sign. */
export const LOGO_SOFT_PX = 600;
export const LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
};
export const LOGO_ACCEPT = Object.keys(LOGO_TYPES).join(",");

import type { LogoMeta, LogoState, LogoStatus } from "@/lib/event-logo-types";
export type { LogoMeta, LogoState, LogoStatus } from "@/lib/event-logo-types";

export interface ReservationLogoRow {
  id: string;
  booking_number: string | null;
  event_name: string | null;
  user_id: string | null;
  contact_email: string | null;
  contact_name: string | null;
  logo_path: string | null;
  logo_original_path: string | null;
  logo_meta: LogoMeta | null;
  logo_status: string | null;
  logo_reviewed_by: string | null;
  logo_reviewed_at: string | null;
}

export const LOGO_COLS =
  "id, booking_number, event_name, user_id, contact_email, contact_name, logo_path, logo_original_path, logo_meta, logo_status, logo_reviewed_by, logo_reviewed_at";

export const originalPath = (reservationId: string, ext: string) => `${reservationId}/original.${ext}`;
export const normalizedPath = (reservationId: string) => `${reservationId}/logo.png`;

export function asLogoStatus(v: unknown): LogoStatus {
  return v === "pending" || v === "approved" || v === "rejected" ? v : "none";
}

// ----------------------------------------------------------------
// Normalisation
// ----------------------------------------------------------------

/**
 * Trim empty margins, cap at 2400 px on the long side, emit a transparent PNG.
 * SVGs are rasterised at a density that lands them near the cap so they stay
 * crisp. A fully blank file throws.
 */
export async function normalizeLogo(
  input: Buffer,
  mime: string
): Promise<{ png: Buffer; original: LogoMeta["original"]; normalized: LogoMeta["normalized"]; soft: boolean }> {
  if (!LOGO_TYPES[mime]) throw new Error("Unsupported file type");
  if (input.byteLength > LOGO_MAX_BYTES) throw new Error("File is larger than 10 MB");

  const probe = await sharp(input, { limitInputPixels: 80_000_000 }).metadata();
  if (!probe.width || !probe.height) throw new Error("That file doesn't look like an image");

  let img: sharp.Sharp;
  if (mime === "image/svg+xml") {
    // render the vector at (about) the output size instead of 72 dpi then upscaling
    const scale = LOGO_MAX_PX / Math.max(probe.width, probe.height);
    const density = Math.min(2400, Math.max(72, Math.round(72 * scale)));
    img = sharp(input, { density, limitInputPixels: 80_000_000 });
  } else {
    img = sharp(input, { limitInputPixels: 80_000_000 }).rotate(); // honour EXIF orientation
  }
  img = img.ensureAlpha();

  // trim uniform margins (transparent, or the flat colour in the top-left corner)
  let trimmed: Buffer;
  try {
    trimmed = await img.clone().trim({ threshold: 12 }).png().toBuffer();
  } catch {
    trimmed = await img.clone().png().toBuffer(); // e.g. nothing to trim
  }
  const tMeta = await sharp(trimmed).metadata();
  if (!tMeta.width || !tMeta.height || tMeta.width < 8 || tMeta.height < 8) {
    throw new Error("The image is blank");
  }
  // fully transparent, or one flat colour edge to edge: nothing to print
  const st = await sharp(trimmed).stats();
  const alpha = st.channels[3];
  const flat = st.channels.slice(0, 3).every((c) => c.max - c.min < 4);
  if ((alpha && alpha.max === 0) || (flat && (!alpha || alpha.max - alpha.min < 4))) {
    throw new Error("The image is blank");
  }

  const png = await sharp(trimmed)
    .resize({ width: LOGO_MAX_PX, height: LOGO_MAX_PX, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  const nMeta = await sharp(png).metadata();

  return {
    png,
    original: { format: probe.format ?? LOGO_TYPES[mime], width: probe.width, height: probe.height, bytes: input.byteLength },
    normalized: { width: nMeta.width ?? 0, height: nMeta.height ?? 0, bytes: png.byteLength },
    // vectors never print soft; rasters do when the trimmed artwork is small
    soft: mime !== "image/svg+xml" && (tMeta.width ?? 0) < LOGO_SOFT_PX,
  };
}

// ----------------------------------------------------------------
// Storage + row updates (service-role client)
// ----------------------------------------------------------------

export async function readLogoRow(db: SupabaseClient, reservationId: string): Promise<ReservationLogoRow | null> {
  const { data } = await db.from("reservations").select(LOGO_COLS).eq("id", reservationId).maybeSingle();
  return (data as ReservationLogoRow | null) ?? null;
}

export async function signedLogoUrl(db: SupabaseClient, path: string | null | undefined, seconds = 600): Promise<string | null> {
  if (!path) return null;
  const { data } = await db.storage.from(LOGO_BUCKET).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

export async function logoState(db: SupabaseClient, row: ReservationLogoRow): Promise<LogoState> {
  const status = asLogoStatus(row.logo_status);
  return {
    status,
    meta: status === "none" ? null : row.logo_meta,
    previewUrl: status === "none" ? null : await signedLogoUrl(db, row.logo_path),
    reviewedAt: row.logo_reviewed_at,
  };
}

/** A signed upload slot for the original file. The browser PUTs straight to storage. */
export async function createLogoUploadSlot(
  db: SupabaseClient,
  reservationId: string,
  mime: string
): Promise<{ path: string; token: string }> {
  const ext = LOGO_TYPES[mime];
  if (!ext) throw new Error("Unsupported file type");
  const path = originalPath(reservationId, ext);
  // a fresh slot replaces whatever was there
  await db.storage.from(LOGO_BUCKET).remove([path]);
  const { data, error } = await db.storage.from(LOGO_BUCKET).createSignedUploadUrl(path, { upsert: true });
  if (error || !data) throw new Error(error?.message ?? "Couldn't prepare the upload");
  return { path: data.path, token: data.token };
}

/**
 * The original has landed in storage: normalise it, write logo.png, and put
 * the reservation into review.
 */
export async function finalizeLogoUpload(
  db: SupabaseClient,
  row: ReservationLogoRow,
  path: string,
  mime: string,
  uploadedBy: string | null,
  originalName?: string
): Promise<LogoState> {
  const expected = originalPath(row.id, LOGO_TYPES[mime] ?? "");
  if (path !== expected) throw new Error("Unexpected upload path");

  const { data: file, error: dlErr } = await db.storage.from(LOGO_BUCKET).download(path);
  if (dlErr || !file) throw new Error("The upload didn't arrive — please try again");
  const input = Buffer.from(await file.arrayBuffer());

  const out = await normalizeLogo(input, mime);
  const nPath = normalizedPath(row.id);
  const { error: upErr } = await db.storage
    .from(LOGO_BUCKET)
    .upload(nPath, out.png, { contentType: "image/png", upsert: true, cacheControl: "60" });
  if (upErr) throw new Error(upErr.message);

  // drop originals of other types left behind by earlier uploads
  const { data: listed } = await db.storage.from(LOGO_BUCKET).list(row.id);
  const stale = (listed ?? [])
    .map((o) => `${row.id}/${o.name}`)
    .filter((p) => p !== path && p !== nPath);
  if (stale.length) await db.storage.from(LOGO_BUCKET).remove(stale);

  const meta: LogoMeta = {
    original: { ...out.original, name: originalName?.slice(0, 120) },
    normalized: out.normalized,
    soft: out.soft,
    uploaded_by: uploadedBy,
    uploaded_at: new Date().toISOString(),
    review_note: null,
  };
  const { data: updated, error } = await db
    .from("reservations")
    .update({
      logo_path: nPath,
      logo_original_path: path,
      logo_meta: meta,
      logo_status: "pending",
      logo_reviewed_by: null,
      logo_reviewed_at: null,
    })
    .eq("id", row.id)
    .select(LOGO_COLS)
    .single();
  if (error || !updated) throw new Error(error?.message ?? "Couldn't save the logo");
  return logoState(db, updated as ReservationLogoRow);
}

export async function removeLogo(db: SupabaseClient, row: ReservationLogoRow): Promise<LogoState> {
  const { data: listed } = await db.storage.from(LOGO_BUCKET).list(row.id);
  const paths = (listed ?? []).map((o) => `${row.id}/${o.name}`);
  if (paths.length) await db.storage.from(LOGO_BUCKET).remove(paths);
  const { data: updated, error } = await db
    .from("reservations")
    .update({
      logo_path: null,
      logo_original_path: null,
      logo_meta: null,
      logo_status: "none",
      logo_reviewed_by: null,
      logo_reviewed_at: null,
    })
    .eq("id", row.id)
    .select(LOGO_COLS)
    .single();
  if (error || !updated) throw new Error(error?.message ?? "Couldn't remove the logo");
  return logoState(db, updated as ReservationLogoRow);
}

export async function reviewLogo(
  db: SupabaseClient,
  row: ReservationLogoRow,
  decision: "approve" | "reject",
  note: string | null,
  reviewerId: string
): Promise<LogoState> {
  if (asLogoStatus(row.logo_status) === "none") throw new Error("There is no logo to review");
  const meta: LogoMeta | null = row.logo_meta
    ? { ...row.logo_meta, review_note: decision === "reject" ? note : null }
    : null;
  const { data: updated, error } = await db
    .from("reservations")
    .update({
      logo_status: decision === "approve" ? "approved" : "rejected",
      logo_reviewed_by: reviewerId,
      logo_reviewed_at: new Date().toISOString(),
      logo_meta: meta,
    })
    .eq("id", row.id)
    .select(LOGO_COLS)
    .single();
  if (error || !updated) throw new Error(error?.message ?? "Couldn't record the review");
  return logoState(db, updated as ReservationLogoRow);
}

/** Signed URL for the map header / signs — only once approved. */
export async function approvedLogoUrl(db: SupabaseClient, row: { logo_status?: string | null; logo_path?: string | null }, seconds = 3600): Promise<string | null> {
  if (asLogoStatus(row.logo_status) !== "approved" || !row.logo_path) return null;
  return signedLogoUrl(db, row.logo_path, seconds);
}

/** The normalised PNG bytes (for the sign renderer). */
export async function downloadLogo(db: SupabaseClient, row: { logo_status?: string | null; logo_path?: string | null }): Promise<Buffer | null> {
  if (asLogoStatus(row.logo_status) !== "approved" || !row.logo_path) return null;
  const { data } = await db.storage.from(LOGO_BUCKET).download(row.logo_path);
  return data ? Buffer.from(await data.arrayBuffer()) : null;
}
