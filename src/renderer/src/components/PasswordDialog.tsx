import { useState } from "react";
import type { EncryptOptions } from "../lib/document/password";

interface Props {
  onSave: (opts: EncryptOptions) => void;
  onClose: () => void;
  busy?: boolean;
}

export function PasswordDialog({ onSave, onClose, busy }: Props): React.JSX.Element {
  const [userPw, setUserPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ownerPw, setOwnerPw] = useState("");
  const [error, setError] = useState("");

  const handleSave = (): void => {
    if (!userPw) { setError("ユーザーパスワードを入力してください"); return; }
    if (userPw !== confirm) { setError("パスワードが一致しません"); return; }
    setError("");
    onSave({ userPassword: userPw, ownerPassword: ownerPw || undefined });
  };

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15 }}>🔐 パスワード保護</h3>
        <p style={{ fontSize: 12, color: "#64748b", marginTop: 0, marginBottom: 16 }}>
          暗号化した PDF を別ファイルとして保存します。
        </p>

        <label style={labelStyle}>ユーザーパスワード（閲覧用）</label>
        <input
          type="password"
          value={userPw}
          onChange={(e) => setUserPw(e.target.value)}
          style={inputStyle}
          placeholder="パスワード"
          autoFocus
        />

        <label style={labelStyle}>確認（再入力）</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          style={inputStyle}
          placeholder="パスワード（確認）"
        />

        <label style={labelStyle}>オーナーパスワード（任意・編集制限用）</label>
        <input
          type="password"
          value={ownerPw}
          onChange={(e) => setOwnerPw(e.target.value)}
          style={inputStyle}
          placeholder="省略時はユーザーパスワードと同じ"
        />

        {error && (
          <div style={{ color: "#dc2626", fontSize: 12, marginBottom: 8 }}>{error}</div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={onClose} style={cancelBtn} disabled={busy}>キャンセル</button>
          <button onClick={handleSave} style={applyBtn} disabled={busy || !userPw}>
            {busy ? "処理中..." : "暗号化して保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

const backdropStyle: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
};

const dialogStyle: React.CSSProperties = {
  background: "#fff", borderRadius: 8, padding: 24, width: 380,
  boxShadow: "0 8px 32px rgba(0,0,0,.2)",
};

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, color: "#475569", marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "6px 8px", fontSize: 13,
  border: "1px solid #cbd5e1", borderRadius: 4, marginBottom: 12, boxSizing: "border-box",
};

const cancelBtn: React.CSSProperties = {
  padding: "6px 16px", borderRadius: 6, border: "1px solid #cbd5e1",
  background: "#fff", cursor: "pointer", fontSize: 13,
};

const applyBtn: React.CSSProperties = {
  padding: "6px 16px", borderRadius: 6, border: "none",
  background: "#1e3a5f", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600,
};
