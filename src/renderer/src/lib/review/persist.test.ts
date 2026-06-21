import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { saveReviewPdf, loadReviewState, readReviewRaw } from "./persist";
import { parseSidecar, REVIEW_SCHEMA } from "./schema";
import type { Stamp } from "../types";
import type { Annotation } from "../annotations/types";

const NO_ANNOTS: Annotation[] = [];

async function blankPdf(pages = 1): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i += 1) doc.addPage([200, 200]);
  return doc.save();
}

function stamp(id: string, over: Partial<Stamp> = {}): Stamp {
  return {
    id,
    page: 0,
    x: 0.2,
    y: 0.3,
    w: 0.15,
    ratio: 1,
    src: "data:image/png;base64,AAAA",
    author: "alice",
    status: "pending",
    ...over,
  };
}

describe("review round-trip", () => {
  it("saves stamps into the Info dict and restores them", async () => {
    const base = await blankPdf();
    const stamps = [stamp("s1"), stamp("s2", { page: 0, status: "approved" })];

    const saved = await saveReviewPdf(base, stamps, NO_ANNOTS, "2026-06-21T00:00:00Z");
    const { stamps: restored } = await loadReviewState(saved);

    expect(restored).toHaveLength(2);
    expect(restored.map((s) => s.id).sort()).toEqual(["s1", "s2"]);
    const s2 = restored.find((s) => s.id === "s2");
    expect(s2?.status).toBe("approved");
    expect(s2?.author).toBe("alice");
  });

  it("round-trips annotations alongside stamps", async () => {
    const base = await blankPdf();
    const annots: Annotation[] = [
      { id: "n1", page: 0, color: "#ff0", kind: "note", x: 0.1, y: 0.1, text: "確認" },
    ];
    const saved = await saveReviewPdf(base, [stamp("s1")], annots, "t1");
    const { annotations } = await loadReviewState(saved);
    expect(annotations).toHaveLength(1);
    expect(annotations[0].kind).toBe("note");
  });

  it("does NOT draw images (non-destructive): plain PDF stays loadable", async () => {
    const base = await blankPdf(2);
    const saved = await saveReviewPdf(base, [stamp("s1")], NO_ANNOTS, "2026-06-21T00:00:00Z");
    const reloaded = await PDFDocument.load(saved);
    expect(reloaded.getPageCount()).toBe(2);
  });

  it("survives a second round-trip with updated status", async () => {
    const base = await blankPdf();
    const first = await saveReviewPdf(base, [stamp("s1")], NO_ANNOTS, "t1");
    const { stamps: loaded } = await loadReviewState(first);
    const approved = loaded.map((s) => ({ ...s, status: "approved" as const }));
    const second = await saveReviewPdf(first, approved, NO_ANNOTS, "t2");
    const { stamps: final } = await loadReviewState(second);
    expect(final[0].status).toBe("approved");
  });

  it("returns empty state for a plain PDF with no review sidecar", async () => {
    const base = await blankPdf();
    expect(await loadReviewState(base)).toEqual({ stamps: [], annotations: [] });
    expect(await readReviewRaw(base)).toBeNull();
  });

  it("normalizes restored stamps (fills review defaults)", async () => {
    const base = await blankPdf();
    const minimal: Stamp = {
      id: "m",
      page: 0,
      x: 0,
      y: 0,
      w: 0.1,
      ratio: 1,
      src: "data:,",
    };
    const saved = await saveReviewPdf(base, [minimal], NO_ANNOTS, "t1");
    const { stamps: restored } = await loadReviewState(saved);
    expect(restored[0].status).toBe("pending");
    expect(restored[0].history).toEqual([]);
    expect(restored[0].opacity).toBe(1);
  });
});

describe("parseSidecar validation", () => {
  it("rejects malformed JSON", () => {
    expect(parseSidecar("{not json")).toBeNull();
  });

  it("rejects a wrong/missing schema", () => {
    expect(parseSidecar(JSON.stringify({ schema: "other", stamps: [] }))).toBeNull();
  });

  it("accepts a valid sidecar and drops invalid stamp entries", () => {
    const raw = JSON.stringify({
      schema: REVIEW_SCHEMA,
      stamps: [
        { id: "ok", page: 0, x: 0, y: 0, w: 0.1, ratio: 1, src: "data:," },
        { id: "bad" }, // missing required numeric fields
      ],
    });
    const parsed = parseSidecar(raw);
    expect(parsed?.stamps).toHaveLength(1);
    expect(parsed?.stamps[0].id).toBe("ok");
  });
});
