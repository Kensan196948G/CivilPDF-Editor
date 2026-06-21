import { describe, it, expect } from "vitest";
import { documentReducer } from "./reducer";
import { initialDocumentState } from "./types";
import type { DocumentState } from "./types";
import type { Stamp } from "../types";
import type { Annotation } from "../annotations/types";

function stamp(id: string, page = 0): Stamp {
  return { id, page, x: 0.1, y: 0.1, w: 0.15, ratio: 1, src: "data:," };
}

function withStamps(...stamps: Stamp[]): DocumentState {
  return { ...initialDocumentState(), stamps, dirty: false };
}

describe("documentReducer dirty tracking", () => {
  const editActions = [
    { type: "ADD_STAMP", stamp: stamp("a") },
    { type: "UPDATE_STAMP", id: "s1", partial: { x: 0.5 } },
    { type: "REMOVE_STAMP", id: "s1" },
    { type: "APPROVE", id: "s1", actor: "u", at: "2026-01-01T00:00:00Z" },
    { type: "REJECT", id: "s1", actor: "u", at: "2026-01-01T00:00:00Z" },
    { type: "COMMENT", id: "s1", actor: "u", at: "2026-01-01T00:00:00Z", comment: "x" },
    {
      type: "ADD_ANNOT",
      annot: { id: "n1", page: 0, color: "#fff", kind: "note", x: 0, y: 0, text: "" } as Annotation,
    },
    { type: "REMOVE_ANNOT", id: "n1" },
    {
      type: "APPLY_OCR",
      result: { pages: [], engine: "tesseract.js", engineVersion: "5", createdAt: "" },
    },
  ] as const;

  it.each(editActions.map((a) => [a.type, a] as const))(
    "sets dirty=true for %s",
    (_label, action) => {
      const next = documentReducer(withStamps(stamp("s1")), action);
      expect(next.dirty).toBe(true);
    },
  );

  it("clears dirty on OPEN_SUCCESS", () => {
    const dirty = { ...initialDocumentState(), dirty: true };
    const next = documentReducer(dirty, {
      type: "OPEN_SUCCESS",
      filePath: "/a.pdf",
      fileName: "a.pdf",
      docBytes: new Uint8Array(),
      pages: [],
      stamps: [],
    });
    expect(next.dirty).toBe(false);
    expect(next.filePath).toBe("/a.pdf");
  });

  it("clears dirty on SAVED and keeps the new path", () => {
    const dirty = { ...withStamps(stamp("s1")), dirty: true };
    const next = documentReducer(dirty, {
      type: "SAVED",
      filePath: "/out.pdf",
      fileName: "out.pdf",
    });
    expect(next.dirty).toBe(false);
    expect(next.filePath).toBe("/out.pdf");
  });

  it("does NOT change dirty for SET_SCALE / SET_BUSY / SELECT", () => {
    const base = withStamps(stamp("s1"));
    expect(documentReducer(base, { type: "SET_SCALE", scale: 2 }).dirty).toBe(false);
    expect(documentReducer(base, { type: "SET_BUSY", busy: true }).dirty).toBe(false);
    expect(documentReducer(base, { type: "SELECT", id: "s1" }).dirty).toBe(false);
  });
});

describe("documentReducer review history", () => {
  it("appends an append-only history event on APPROVE", () => {
    const next = documentReducer(withStamps(stamp("s1")), {
      type: "APPROVE",
      id: "s1",
      actor: "alice",
      at: "2026-06-21T00:00:00Z",
      comment: "ok",
    });
    const s = next.stamps[0];
    expect(s.status).toBe("approved");
    expect(s.history).toEqual([
      { status: "approved", actor: "alice", at: "2026-06-21T00:00:00Z", comment: "ok" },
    ]);
  });

  it("accumulates history across multiple review actions", () => {
    let state = withStamps(stamp("s1"));
    state = documentReducer(state, { type: "APPROVE", id: "s1", actor: "a", at: "t1" });
    state = documentReducer(state, { type: "REJECT", id: "s1", actor: "b", at: "t2", comment: "no" });
    const s = state.stamps[0];
    expect(s.status).toBe("rejected");
    expect(s.history).toHaveLength(2);
    expect(s.comment).toBe("no");
  });

  it("COMMENT keeps the current status", () => {
    let state = withStamps(stamp("s1"));
    state = documentReducer(state, { type: "APPROVE", id: "s1", actor: "a", at: "t1" });
    state = documentReducer(state, { type: "COMMENT", id: "s1", actor: "a", at: "t2", comment: "hi" });
    const s = state.stamps[0];
    expect(s.status).toBe("approved");
    expect(s.history).toHaveLength(2);
  });
});

describe("documentReducer PAGE_EDIT remapping", () => {
  it("remaps stamp pages and drops removed pages", () => {
    const base: DocumentState = {
      ...initialDocumentState(),
      stamps: [stamp("s0", 0), stamp("s1", 1), stamp("s2", 2)],
    };
    // Simulate deleting page 1: page 0 stays, page 1 is removed, page 2 -> 1.
    const remap = (old: number): number | null =>
      old === 1 ? null : old === 2 ? 1 : 0;
    const next = documentReducer(base, {
      type: "PAGE_EDIT",
      docBytes: new Uint8Array([1]),
      pages: [],
      remap,
    });
    expect(next.stamps.map((s) => s.id)).toEqual(["s0", "s2"]);
    expect(next.stamps.find((s) => s.id === "s2")?.page).toBe(1);
    expect(next.dirty).toBe(true);
    expect(next.revision).toBe(base.revision + 1);
  });
});
