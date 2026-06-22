import { useState, type CSSProperties } from "react";
import { loadDxConfig, saveDxConfig, clearDxConfig } from "../lib/dx/config";

interface Props {
  onClose: () => void;
}

/** Modal to configure the CivilPDF-DX connection (persisted in localStorage). */
export function DxSettingsModal({ onClose }: Props) {
  const existing = loadDxConfig();
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [password, setPassword] = useState(existing?.password ?? "");

  function handleSave(): void {
    saveDxConfig({ baseUrl: baseUrl.trim(), email: email.trim(), password });
    onClose();
  }

  function handleClear(): void {
    clearDxConfig();
    onClose();
  }

  const canSave =
    baseUrl.trim().length > 0 && email.trim().length > 0 && password.length > 0;

  return (
    <div style={overlay} onClick={onClose} role="presentation">
      <div
        style={modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="DX 接続設定"
      >
        <h3 style={{ marginTop: 0 }}>DX 接続設定</h3>
        <p style={{ fontSize: 12, color: "#64748b", marginTop: 0 }}>
          レビュー結果の送信先 CivilPDF-DX を設定します。
        </p>
        <label style={label}>
          DX ベース URL
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://192.168.0.185:8000"
            style={input}
          />
        </label>
        <label style={label}>
          メールアドレス
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="reviewer@example.com"
            style={input}
          />
        </label>
        <label style={label}>
          パスワード
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={input}
          />
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            style={{
              ...btn,
              background: canSave ? "#16a34a" : "#94a3b8",
              cursor: canSave ? "pointer" : "not-allowed",
            }}
          >
            保存
          </button>
          <button
            type="button"
            onClick={handleClear}
            style={{ ...btn, background: "#dc2626" }}
          >
            クリア
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ ...btn, background: "#475569", marginLeft: "auto" }}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modal: CSSProperties = {
  background: "#fff",
  borderRadius: 8,
  padding: 20,
  width: 380,
  maxWidth: "90vw",
  boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
};

const label: CSSProperties = {
  display: "block",
  fontSize: 13,
  color: "#334155",
  marginBottom: 10,
};

const input: CSSProperties = {
  display: "block",
  width: "100%",
  padding: "7px 9px",
  marginTop: 4,
  borderRadius: 4,
  border: "1px solid #cbd5e1",
  boxSizing: "border-box",
};

const btn: CSSProperties = {
  padding: "7px 14px",
  borderRadius: 4,
  border: "none",
  color: "#fff",
  cursor: "pointer",
  fontSize: 13,
};
