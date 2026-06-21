import type { Stamp } from "../types";
import { normalizeStamp } from "../types";
import type { Annotation } from "../annotations/types";

/**
 * Versioned JSON contract for the non-destructive review round-trip. The same
 * structure is intended to be exchangeable with the CivilPDF-DX approval
 * console, so keep it self-describing and backward compatible.
 */
export const REVIEW_SCHEMA = "civilpdf.review/v1" as const;

/** Custom key written into the PDF Info dictionary. */
export const REVIEW_INFO_KEY = "CivilPdfReview";

export interface ReviewSidecarV1 {
  schema: typeof REVIEW_SCHEMA;
  generator: "CivilPDF-Editor";
  savedAt: string; // ISO 8601
  stamps: Stamp[]; // full stamps including review metadata
  annotations: Annotation[]; // markup annotations (kept editable on reopen)
}

/** Editable overlay state restored from a review-saved PDF. */
export interface ReviewState {
  stamps: Stamp[];
  annotations: Annotation[];
}

export function buildSidecar(
  stamps: Stamp[],
  annotations: Annotation[],
  savedAt: string,
): ReviewSidecarV1 {
  return {
    schema: REVIEW_SCHEMA,
    generator: "CivilPDF-Editor",
    savedAt,
    stamps: stamps.map(normalizeStamp),
    annotations,
  };
}

function isStampLike(v: unknown): v is Stamp {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.id === "string" &&
    typeof s.page === "number" &&
    typeof s.x === "number" &&
    typeof s.y === "number" &&
    typeof s.w === "number" &&
    typeof s.ratio === "number" &&
    typeof s.src === "string"
  );
}

function isAnnotationLike(v: unknown): v is Annotation {
  if (typeof v !== "object" || v === null) return false;
  const a = v as Record<string, unknown>;
  return (
    typeof a.id === "string" &&
    typeof a.page === "number" &&
    typeof a.kind === "string"
  );
}

/**
 * Parse a sidecar JSON string. Returns normalized overlay state, or null if the
 * payload is missing/invalid (so callers can fall back to empty state).
 */
export function parseSidecar(raw: string): ReviewState | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const obj = data as Record<string, unknown>;
  if (obj.schema !== REVIEW_SCHEMA) return null;
  if (!Array.isArray(obj.stamps)) return null;
  const stamps = obj.stamps.filter(isStampLike).map(normalizeStamp);
  const annotations = Array.isArray(obj.annotations)
    ? obj.annotations.filter(isAnnotationLike)
    : [];
  return { stamps, annotations };
}
