/** Review status of a stamp in the approval workflow. */
export type ReviewStatus = "pending" | "approved" | "rejected";

/** One append-only audit event in a stamp's review history. */
export interface ReviewEvent {
  status: ReviewStatus; // status this event transitioned to
  actor: string; // who performed the action
  at: string; // ISO 8601 timestamp
  comment?: string;
}

/**
 * A placed stamp. Position/size are page-relative fractions for resolution
 * independence. Review fields are optional for backward compatibility with
 * v1.0.0 documents; use {@link normalizeStamp} to fill defaults.
 */
export interface Stamp {
  id: string;
  page: number; // 0-based page index
  x: number; // left edge as fraction of page width (0..1)
  y: number; // top edge as fraction of page height (0..1)
  w: number; // width as fraction of page width (0..1)
  ratio: number; // image natural aspect ratio (width / height)
  src: string; // PNG data URL

  // --- review extension (all optional) ---
  createdAt?: string; // ISO 8601
  author?: string; // creator name
  status?: ReviewStatus; // defaults to "pending"
  comment?: string; // latest comment (display shortcut)
  history?: ReviewEvent[]; // append-only audit trail
  rotation?: number; // degrees, defaults to 0
  opacity?: number; // 0..1, defaults to 1
}

/** A stamp with all review fields guaranteed present. */
export type NormalizedStamp = Stamp &
  Required<
    Pick<
      Stamp,
      "createdAt" | "author" | "status" | "history" | "rotation" | "opacity"
    >
  >;

/**
 * Fill in default values for the optional review fields. Idempotent: an
 * already-normalized stamp keeps its existing values.
 */
export function normalizeStamp(s: Stamp): NormalizedStamp {
  return {
    ...s,
    createdAt: s.createdAt ?? new Date().toISOString(),
    author: s.author ?? "",
    status: s.status ?? "pending",
    history: s.history ?? [],
    rotation: s.rotation ?? 0,
    opacity: s.opacity ?? 1,
  };
}
