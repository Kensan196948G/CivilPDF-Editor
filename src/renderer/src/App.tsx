import { useState } from "react";
import { PdfViewer } from "./components/PdfViewer";
import { formatBytes } from "./lib/format";

interface OpenedPdf {
  name: string;
  bytes: Uint8Array;
}

export function App(): React.JSX.Element {
  const [pdf, setPdf] = useState<OpenedPdf | null>(null);
  const [loading, setLoading] = useState(false);

  const handleOpen = async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await window.api.openPdf();
      if (res) setPdf(res);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        color: "#1a1a1a",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 16px",
          background: "#1e3a5f",
          color: "#fff",
        }}
      >
        <strong style={{ fontSize: 15 }}>CivilPDF Editor</strong>
        <span style={{ fontSize: 12, opacity: 0.8 }}>
          建設・土木業向け PDF エディター
        </span>
        <button
          onClick={handleOpen}
          disabled={loading}
          style={{
            marginLeft: "auto",
            padding: "6px 14px",
            borderRadius: 6,
            border: "none",
            background: "#fff",
            color: "#1e3a5f",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {loading ? "読み込み中..." : "PDF を開く"}
        </button>
      </header>

      <main
        style={{
          flex: 1,
          overflow: "auto",
          padding: 16,
          background: "#f4f5f7",
        }}
      >
        {!pdf ? (
          <div style={{ textAlign: "center", color: "#888", marginTop: 80 }}>
            <p style={{ fontSize: 15 }}>PDF を開いて表示します</p>
            <p style={{ fontSize: 12 }}>
              電子印鑑・OCR・大判図面対応は今後のマイルストーンで追加されます
            </p>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 12, fontSize: 13, color: "#444" }}>
              📄 {pdf.name} （{formatBytes(pdf.bytes.byteLength)}）
            </div>
            <PdfViewer bytes={pdf.bytes} />
          </>
        )}
      </main>
    </div>
  );
}
