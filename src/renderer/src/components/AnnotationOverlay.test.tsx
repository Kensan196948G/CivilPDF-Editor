import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { AnnotationOverlay } from "./AnnotationOverlay";
import type { Annotation } from "../lib/annotations/types";

function renderOverlay(annotations: Annotation[]) {
  return render(
    <AnnotationOverlay
      pageIndex={0}
      annotations={annotations}
      activeTool={null}
      activeColor="#ffeb3b"
      viewportWidth={600}
      viewportHeight={800}
      onAdd={vi.fn()}
      onRemove={vi.fn()}
    />,
  );
}

describe("AnnotationOverlay — text edit rendering", () => {
  const textEdit: Annotation = {
    id: "te1",
    page: 0,
    color: "#000000",
    kind: "textedit",
    rect: { x: 0.1, y: 0.1, w: 0.3, h: 0.03 },
    baselineFrac: 0.124,
    fontHeightFrac: 0.024,
    originalText: "旧テキスト",
    newText: "新しい日本語テキスト",
  };

  it("renders the replacement text on screen (regression: was dropped as null)", () => {
    const { getByText } = renderOverlay([textEdit]);
    // The new text must be visible immediately after confirming the edit.
    expect(getByText("新しい日本語テキスト")).toBeTruthy();
  });

  it("draws a white whiteout rectangle over the original text", () => {
    const { container } = renderOverlay([textEdit]);
    const whiteRects = container.querySelectorAll('rect[fill="#ffffff"]');
    expect(whiteRects.length).toBeGreaterThanOrEqual(1);
  });

  it("exposes the original text as a tooltip", () => {
    const { container } = renderOverlay([textEdit]);
    const title = container.querySelector("title");
    expect(title?.textContent).toContain("旧テキスト");
  });

  it("places the text on the original baseline (not box-centered)", () => {
    const { container } = renderOverlay([textEdit]);
    const text = container.querySelector("text");
    // baselineFrac 0.124 → y = "12.4%"; default (alphabetic) baseline so the
    // glyph sits exactly where the original text's baseline was.
    expect(text?.getAttribute("y")).toBe("12.4%");
    expect(text?.getAttribute("dominant-baseline")).toBeNull();
  });

  it("positions x with a plain percentage + dx, never calc() (WebKitGTK ignores SVG calc)", () => {
    const { container } = renderOverlay([textEdit]);
    const text = container.querySelector("text");
    // rect.x 0.1 → "10%". A pixel inset must come from dx, not calc() in the
    // attribute (which the Tauri webview drops, snapping x to 0 = far left).
    expect(text?.getAttribute("x")).toBe("10%");
    expect(text?.getAttribute("x")).not.toContain("calc");
    expect(text?.getAttribute("dx")).toBe("1");
  });
});
