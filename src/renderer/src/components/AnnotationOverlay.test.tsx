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
    originalText: "旧テキスト",
    newText: "新しい日本語テキスト",
    fontSize: 12,
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
});
