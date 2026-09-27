// Event logo — shared types (safe to import from client components; no sharp here).

export type LogoStatus = "none" | "pending" | "approved" | "rejected";

export interface LogoMeta {
  original: { format: string; width: number; height: number; bytes: number; name?: string };
  normalized: { width: number; height: number; bytes: number };
  soft: boolean;
  uploaded_by: string | null;
  uploaded_at: string;
  review_note: string | null;
}

/** What the UI needs to draw the logo card. */
export interface LogoState {
  status: LogoStatus;
  meta: LogoMeta | null;
  /** Signed URL of the normalised PNG (10 min). Null when there is no logo. */
  previewUrl: string | null;
  reviewedAt: string | null;
}
