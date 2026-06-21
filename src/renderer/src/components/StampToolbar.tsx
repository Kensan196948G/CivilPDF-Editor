import { useRef, useState } from "react";
import {
  fileToDataUrl,
  formatStampDate,
  generateTextStampDataUrl,
  imageNaturalRatio,
} from "../lib/stamp";

interface Template {
  src: string;
  ratio: number;
}

interface Props {
  template: Template | null;
  author: string;
  onSetTemplate: (t: Template) => void;
  onClearTemplate: () => void;
  onAuthorChange: (author: string) => void;
}

export function StampToolbar({
  template,
  author,
  onSetTemplate,
  onClearTemplate,
  onAuthorChange,
}: Props): React.JSX.Element {
  const [name, setName] = useState("承認");
  const fileRef = useRef<HTMLInputElement>(null);

  const makeTextStamp = async (): Promise<void> => {
    const src = generateTextStampDataUrl(name, formatStampDate(new Date()));
    if (!src) return;
    const ratio = await imageNaturalRatio(src);
    onSetTemplate({ src, ratio });
  };

  const onPickFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;
    const src = await fileToDataUrl(file);
    const ratio = await imageNaturalRatio(src);
    onSetTemplate({ src, ratio });
    e.target.value = "";
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        padding: "8px 16px",
        borderBottom: "1px solid #e2e4e8",
        background: "#fff",
        fontSize: 13,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <label htmlFor="stampName">氏名/役職</label>
        <input
          id="stampName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            width: 100,
            padding: "4px 6px",
            border: "1px solid #ccc",
            borderRadius: 4,
          }}
        />
        <button onClick={makeTextStamp} style={btn}>
          丸印を作成
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <label htmlFor="stampAuthor">レビュー担当</label>
        <input
          id="stampAuthor"
          value={author}
          placeholder="担当者名"
          onChange={(e) => onAuthorChange(e.target.value)}
          style={{
            width: 100,
            padding: "4px 6px",
            border: "1px solid #ccc",
            borderRadius: 4,
          }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button onClick={() => fileRef.current?.click()} style={btn}>
          印影画像を取込
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/*"
          onChange={onPickFile}
          style={{ display: "none" }}
        />
      </div>

      {template && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginLeft: "auto",
            color: "#16a34a",
            fontWeight: 600,
          }}
        >
          <img
            src={template.src}
            alt="選択中の印影"
            style={{ height: 28, width: "auto" }}
          />
          配置モード: ページをクリックで押印
          <button
            onClick={onClearTemplate}
            style={{ ...btn, color: "#dc2626" }}
          >
            解除
          </button>
        </div>
      )}
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: 4,
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  cursor: "pointer",
};
