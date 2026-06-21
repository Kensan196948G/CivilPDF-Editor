import type { Stamp, ReviewEvent, ReviewStatus } from "../types";
import type { Annotation } from "../annotations/types";
import type { DocumentState, DocumentAction, PageIndexMap } from "./types";

/** Append a review event and update status/comment on the matching stamp. */
function applyReview(
  stamps: Stamp[],
  id: string,
  status: ReviewStatus,
  event: ReviewEvent,
): Stamp[] {
  return stamps.map((s) => {
    if (s.id !== id) return s;
    const history = [...(s.history ?? []), event];
    return {
      ...s,
      status,
      comment: event.comment ?? s.comment,
      history,
    };
  });
}

/** Remap a list of page-indexed items, dropping those on removed pages. */
function remapByPage<T extends { page: number }>(
  items: T[],
  remap: PageIndexMap,
): T[] {
  const out: T[] = [];
  for (const item of items) {
    const next = remap(item.page);
    if (next !== null) out.push({ ...item, page: next });
  }
  return out;
}

/**
 * The single source of truth for document mutations. Every action that
 * represents an unsaved edit sets `dirty: true` here, so dirty tracking can
 * never drift out of sync with the data. View-only actions (scale, busy,
 * select) leave `dirty` untouched.
 */
export function documentReducer(
  state: DocumentState,
  action: DocumentAction,
): DocumentState {
  switch (action.type) {
    case "OPEN_SUCCESS":
      return {
        ...state,
        filePath: action.filePath,
        fileName: action.fileName,
        docBytes: action.docBytes,
        pages: action.pages,
        stamps: action.stamps,
        annotations: action.annotations,
        ocrResult: null,
        selectedId: null,
        dirty: false,
        revision: state.revision + 1,
      };

    case "PAGE_EDIT":
      return {
        ...state,
        docBytes: action.docBytes,
        pages: action.pages,
        stamps: remapByPage(state.stamps, action.remap),
        annotations: remapByPage(state.annotations, action.remap),
        dirty: true,
        revision: state.revision + 1,
      };

    case "ADD_STAMP":
      return { ...state, stamps: [...state.stamps, action.stamp], dirty: true };

    case "UPDATE_STAMP":
      return {
        ...state,
        stamps: state.stamps.map((s) =>
          s.id === action.id ? { ...s, ...action.partial } : s,
        ),
        dirty: true,
      };

    case "REMOVE_STAMP":
      return {
        ...state,
        stamps: state.stamps.filter((s) => s.id !== action.id),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
        dirty: true,
      };

    case "APPROVE":
      return {
        ...state,
        stamps: applyReview(state.stamps, action.id, "approved", {
          status: "approved",
          actor: action.actor,
          at: action.at,
          comment: action.comment,
        }),
        dirty: true,
      };

    case "REJECT":
      return {
        ...state,
        stamps: applyReview(state.stamps, action.id, "rejected", {
          status: "rejected",
          actor: action.actor,
          at: action.at,
          comment: action.comment,
        }),
        dirty: true,
      };

    case "COMMENT": {
      // A comment records an event without changing the current status.
      const current = state.stamps.find((s) => s.id === action.id);
      const status: ReviewStatus = current?.status ?? "pending";
      return {
        ...state,
        stamps: applyReview(state.stamps, action.id, status, {
          status,
          actor: action.actor,
          at: action.at,
          comment: action.comment,
        }),
        dirty: true,
      };
    }

    case "ADD_ANNOT":
      return {
        ...state,
        annotations: [...state.annotations, action.annot],
        dirty: true,
      };

    case "REMOVE_ANNOT":
      return {
        ...state,
        annotations: state.annotations.filter(
          (a: Annotation) => a.id !== action.id,
        ),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
        dirty: true,
      };

    case "APPLY_OCR":
      return { ...state, ocrResult: action.result, dirty: true };

    case "SELECT":
      return { ...state, selectedId: action.id };

    case "SAVED":
      return {
        ...state,
        filePath: action.filePath,
        fileName: action.fileName,
        dirty: false,
      };

    case "SET_SCALE":
      return { ...state, scale: action.scale };

    case "SET_BUSY":
      return { ...state, busy: action.busy };

    default:
      return state;
  }
}
