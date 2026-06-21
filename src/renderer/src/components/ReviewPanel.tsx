import { useState } from "react";
import type { Stamp, ReviewStatus } from "../lib/types";

interface Props {
  stamps: Stamp[];
  selectedId: string | null;
  author: string;
  onSelect: (id: string | null) => void;
  onApprove: (id: string, actor: string, comment?: string) => void;
  onReject: (id: string, actor: string, comment?: string) => void;
  onRemove: (id: string) => void;
}

type Filter = "all" | ReviewStatus;

const STATUS_META: Record<ReviewStatus, { label: string; color: string }> = {
  pending: { label: "承認待ち", color: "#92400e" },
  approved: { label: "承認済み", color: "#16a34a" },
  rejected: { label: "却下", color: "#dc2626" },
};

export function ReviewPanel({
  stamps,
  selectedId,
  author,
  onSelect,
  onApprove,
  onReject,
  onRemove,
}: Props): React.JSX.Element {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = stamps.reduce(
    (acc, s) => {
      const st = s.status ?? "pending";
      acc[st] += 1;
      return acc;
    },
    { pending: 0, approved: 0, rejected: 0 } as Record<ReviewStatus, number>,
  );

  const visible = stamps.filter(
    (s) => filter === "all" || (s.status ?? "pending") === filter,
  );

  return (
    <aside style={panelStyle}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
        印鑑レビュー（{stamps.length}）
      </div>
      <div style={{ fontSize: 12, color: "#444", marginBottom: 8 }}>
        承認 {counts.approved} / 却下 {counts.rejected} / 待ち {counts.pending}
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
        {(["all", "pending", "approved", "rejected"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={chipStyle(filter === f)}
          >
            {f === "all" ? "すべて" : STATUS_META[f].label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div style={{ fontSize: 12, color: "#888" }}>該当する印鑑はありません</div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {visible.map((s) => {
            const st = s.status ?? "pending";
            const meta = STATUS_META[st];
            const selected = s.id === selectedId;
            return (
              <li
                key={s.id}
                onClick={() => onSelect(s.id)}
                style={{
                  border: `1px solid ${selected ? "#1e3a5f" : "#e2e4e8"}`,
                  borderRadius: 6,
                  padding: 8,
                  background: selected ? "#eef2f7" : "#fff",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <img src={s.src} alt="印影" style={{ height: 24, width: "auto" }} />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>
                    P{s.page + 1}
                  </span>
                  <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: meta.color }}>
                    {meta.label}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
                  {s.author || "（作成者未設定）"}
                  {s.createdAt ? ` ・ ${s.createdAt.slice(0, 10)}` : ""}
                </div>
                {s.comment && (
                  <div style={{ fontSize: 11, color: "#444", marginTop: 2 }}>
                    💬 {s.comment}
                  </div>
                )}
                <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                  <button onClick={(e) => { e.stopPropagation(); onApprove(s.id, author); }} style={actBtn("#16a34a")}>
                    承認
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onReject(s.id, author); }} style={actBtn("#dc2626")}>
                    却下
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onRemove(s.id); }} style={actBtn("#555")}>
                    削除
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

const panelStyle: React.CSSProperties = {
  width: 300,
  flexShrink: 0,
  borderLeft: "1px solid #d1d5db",
  background: "#f9fafb",
  padding: 12,
  overflow: "auto",
};

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: "3px 8px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: active ? "#1e3a5f" : "#fff",
    color: active ? "#fff" : "#333",
    fontSize: 11,
    cursor: "pointer",
  };
}

function actBtn(bg: string): React.CSSProperties {
  return {
    padding: "3px 10px",
    borderRadius: 4,
    border: "none",
    background: bg,
    color: "#fff",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
  };
}
