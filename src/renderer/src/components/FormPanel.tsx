import type { FormField } from "../lib/document/form-reader";

interface Props {
  fields: FormField[];
  onClose: () => void;
}

const TYPE_LABEL: Record<string, string> = {
  text: "テキスト",
  checkbox: "チェックボックス",
  radio: "ラジオボタン",
  choice: "選択肢",
  button: "ボタン",
  unknown: "不明",
};

export function FormPanel({ fields, onClose }: Props): React.JSX.Element {
  const byPage = fields.reduce<Record<number, FormField[]>>((acc, f) => {
    (acc[f.page] ??= []).push(f);
    return acc;
  }, {});

  const pages = Object.keys(byPage)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div style={panelStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <strong style={{ fontSize: 14 }}>フォームフィールド ({fields.length}件)</strong>
        <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 16 }}>×</button>
      </div>

      {fields.length === 0 ? (
        <p style={{ fontSize: 12, color: "#888" }}>AcroFormフィールドが見つかりませんでした。</p>
      ) : (
        <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 200px)" }}>
          {pages.map((pageNum) => (
            <div key={pageNum} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#1e3a5f", marginBottom: 4 }}>
                ページ {pageNum}
              </div>
              <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f0f4f8" }}>
                    <th style={th}>フィールド名</th>
                    <th style={th}>種別</th>
                    <th style={th}>値</th>
                  </tr>
                </thead>
                <tbody>
                  {byPage[pageNum].map((f, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <td style={td}>{f.fieldName}</td>
                      <td style={td}>{TYPE_LABEL[f.fieldType] ?? f.fieldType}</td>
                      <td style={{ ...td, fontFamily: "monospace", wordBreak: "break-all" }}>
                        {f.value || <span style={{ color: "#aaa" }}>(空)</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  width: 300,
  background: "#fff",
  borderLeft: "1px solid #e5e7eb",
  padding: "14px 12px",
  fontSize: 12,
  flexShrink: 0,
};
const th: React.CSSProperties = { padding: "4px 6px", textAlign: "left", fontWeight: 600, borderBottom: "2px solid #ddd" };
const td: React.CSSProperties = { padding: "4px 6px", verticalAlign: "top" };
