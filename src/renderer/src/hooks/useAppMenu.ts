import { useEffect, useRef } from "react";
import {
  Menu,
  Submenu,
  MenuItem,
  PredefinedMenuItem,
} from "@tauri-apps/api/menu";

/** Map of menu item id -> handler. */
export type MenuHandlers = Record<string, () => void | Promise<void>>;

interface ItemDef {
  id: string;
  label: string;
  accelerator?: string;
  needsDoc?: boolean; // disabled until a document is open
}

const FILE_ITEMS: ItemDef[] = [
  { id: "file.open", label: "PDF を開く…", accelerator: "CmdOrCtrl+O" },
  { id: "file.save", label: "保存（レビュー）", accelerator: "CmdOrCtrl+S", needsDoc: true },
  { id: "file.saveAs", label: "名前を付けて保存…", accelerator: "CmdOrCtrl+Shift+S", needsDoc: true },
  { id: "file.finalize", label: "確定保存（フラット化）…", needsDoc: true },
  { id: "file.exportDocx", label: "Word で書き出し…", needsDoc: true },
  { id: "file.exportImages", label: "画像で書き出し…", needsDoc: true },
  { id: "file.print", label: "印刷…", accelerator: "CmdOrCtrl+P", needsDoc: true },
];

const EDIT_ITEMS: ItemDef[] = [
  { id: "edit.rotateCw", label: "選択ページを右回転", needsDoc: true },
  { id: "edit.rotateCcw", label: "選択ページを左回転", needsDoc: true },
  { id: "edit.deletePage", label: "選択ページを削除", needsDoc: true },
  { id: "edit.insertFrom", label: "別 PDF を挿入…", needsDoc: true },
];

const VIEW_ITEMS: ItemDef[] = [
  { id: "view.zoomIn", label: "拡大", accelerator: "CmdOrCtrl+=", needsDoc: true },
  { id: "view.zoomOut", label: "縮小", accelerator: "CmdOrCtrl+-", needsDoc: true },
  { id: "view.zoomReset", label: "等倍", accelerator: "CmdOrCtrl+0", needsDoc: true },
];

const ALL_ITEMS = [...FILE_ITEMS, ...EDIT_ITEMS, ...VIEW_ITEMS];

/**
 * Build the native application menu once and wire each item to the latest
 * handler via a ref registry (avoids stale closures without rebuilding the
 * menu every render). Doc-dependent items are enabled/disabled from `canSave`.
 */
export function useAppMenu(handlers: MenuHandlers, canSave: boolean): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const itemsRef = useRef(new Map<string, MenuItem>());
  const builtRef = useRef(false);

  useEffect(() => {
    if (builtRef.current) return;
    builtRef.current = true;
    let cancelled = false;

    const build = async (): Promise<void> => {
      const make = async (def: ItemDef): Promise<MenuItem> => {
        const item = await MenuItem.new({
          id: def.id,
          text: def.label,
          accelerator: def.accelerator,
          enabled: !def.needsDoc,
          action: () => {
            void handlersRef.current[def.id]?.();
          },
        });
        itemsRef.current.set(def.id, item);
        return item;
      };
      const sep = (): Promise<PredefinedMenuItem> =>
        PredefinedMenuItem.new({ item: "Separator" });

      const fileItems = [];
      fileItems.push(await make(FILE_ITEMS[0]), await sep());
      for (const d of FILE_ITEMS.slice(1)) fileItems.push(await make(d));
      fileItems.push(await sep(), await PredefinedMenuItem.new({ item: "Quit", text: "終了" }));

      const editItems = [];
      for (const d of EDIT_ITEMS) editItems.push(await make(d));
      const viewItems = [];
      for (const d of VIEW_ITEMS) viewItems.push(await make(d));

      const menu = await Menu.new({
        items: [
          await Submenu.new({ text: "ファイル", items: fileItems }),
          await Submenu.new({ text: "編集", items: editItems }),
          await Submenu.new({ text: "表示", items: viewItems }),
        ],
      });
      if (!cancelled) await menu.setAsAppMenu();
    };

    // Swallow errors so the app still renders outside a Tauri runtime (tests).
    void build().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    for (const def of ALL_ITEMS) {
      if (!def.needsDoc) continue;
      const item = itemsRef.current.get(def.id);
      if (item) void item.setEnabled(canSave).catch(() => {});
    }
  }, [canSave]);
}
