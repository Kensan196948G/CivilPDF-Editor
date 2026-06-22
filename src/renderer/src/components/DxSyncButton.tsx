import { useState, type CSSProperties } from "react";
import type { Stamp } from "../lib/types";
import type { Annotation } from "../lib/annotations/types";
import { buildSidecar } from "../lib/review/schema";
import { createDxClient } from "../lib/dx/client";
import { loadDxConfig } from "../lib/dx/config";

interface Props {
  docId: string | null;
  stamps: Stamp[];
  annotations: Annotation[];
  onOpenSettings: () => void;
}

type SyncStatus = "idle" | "sending" | "done" | "error";

/**
 * Pushes the current review (stamps + annotations as a civilpdf.review/v1
 * sidecar) to CivilPDF-DX. The target docId comes from the PDF Info dict
 * (readDxDocId in App); when absent the PDF was not distributed by DX and the
 * button is disabled. Missing DX config opens the settings modal.
 */
export function DxSyncButton({
  docId,
  stamps,
  annotations,
  onOpenSettings,
}: Props) {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [message, setMessage] = useState("");

  async function handleSync(): Promise<void> {
    const config = loadDxConfig();
    if (!config) {
      onOpenSettings();
      return;
    }
    if (!docId) return;
    setStatus("sending");
    setMessage("");
    try {
      const sidecar = buildSidecar(
        stamps,
        annotations,
        new Date().toISOString(),
      );
      await createDxClient(config).syncReview(docId, sidecar);
      setStatus("done");
      setMessage("DX に送信しました");
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "送信に失敗しました");
    }
  }

  const btnStyle: CSSProperties = {
    padding: "6px 10px",
    borderRadius: 4,
    border: "none",
    cursor: docId ? "pointer" : "not-allowed",
    background: docId ? "#0ea5e9" : "#94a3b8",
    color: "#fff",
    fontSize: 13,
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <button
        type="button"
        onClick={() => void handleSync()}
        disabled={status === "sending" || !docId}
        style={btnStyle}
        title={
          docId
            ? "レビュー結果を DX 承認コンソールへ送信"
            : "DX 由来の PDF ではありません（docId なし）"
        }
      >
        {status === "sending" ? "送信中..." : "🔼 DX 送信"}
      </button>
      <button
        type="button"
        onClick={onOpenSettings}
        title="DX 接続設定"
        style={{ ...btnStyle, background: "#475569", padding: "6px 8px" }}
      >
        ⚙️
      </button>
      {message && (
        <span
          style={{
            fontSize: 12,
            color: status === "error" ? "#fca5a5" : "#bbf7d0",
          }}
        >
          {message}
        </span>
      )}
    </span>
  );
}
