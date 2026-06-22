import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DxSyncButton } from "./DxSyncButton";

vi.mock("../lib/dx/config", () => ({ loadDxConfig: vi.fn() }));
vi.mock("../lib/dx/client", () => ({ createDxClient: vi.fn() }));

import { loadDxConfig } from "../lib/dx/config";
import { createDxClient } from "../lib/dx/client";

describe("DxSyncButton", () => {
  beforeEach(() => vi.clearAllMocks());

  it("disables the send button when there is no docId", () => {
    render(
      <DxSyncButton
        docId={null}
        stamps={[]}
        annotations={[]}
        onOpenSettings={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /DX 送信/ })).toBeDisabled();
  });

  it("opens settings when DX is not configured", async () => {
    vi.mocked(loadDxConfig).mockReturnValue(null);
    const onOpenSettings = vi.fn();
    const user = userEvent.setup();
    render(
      <DxSyncButton
        docId="doc-1"
        stamps={[]}
        annotations={[]}
        onOpenSettings={onOpenSettings}
      />,
    );
    await user.click(screen.getByRole("button", { name: /DX 送信/ }));
    expect(onOpenSettings).toHaveBeenCalled();
  });

  it("syncs the review to DX with the docId when configured", async () => {
    vi.mocked(loadDxConfig).mockReturnValue({
      baseUrl: "http://dx",
      email: "a@b.com",
      password: "p",
    });
    const syncReview = vi.fn().mockResolvedValue(undefined);
    vi.mocked(createDxClient).mockReturnValue({
      login: vi.fn(),
      sendReviewSidecar: vi.fn(),
      syncReview,
    });
    const user = userEvent.setup();
    render(
      <DxSyncButton
        docId="doc-9"
        stamps={[]}
        annotations={[]}
        onOpenSettings={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /DX 送信/ }));
    await waitFor(() => {
      expect(syncReview).toHaveBeenCalledWith(
        "doc-9",
        expect.objectContaining({ schema: "civilpdf.review/v1" }),
      );
    });
    expect(await screen.findByText("DX に送信しました")).toBeInTheDocument();
  });
});
