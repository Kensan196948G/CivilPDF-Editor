import { useReducer, useCallback, useEffect, useRef } from "react";
import { open as dialogOpen, confirm } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { loadPdf } from "../pdf";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { addWatermark, type WatermarkOptions } from "./watermark";
import { encryptPdf, type EncryptOptions } from "./password";
import { updatePdfMetadata, type PdfMetadata } from "./metadata";
import type { Stamp } from "../types";
import type { Annotation } from "../annotations/types";
import type { OcrDocumentResult } from "../ocr/types";
import type { EmbedOptions } from "../embed";
import { loadReviewState } from "../review/persist";
import {
  rotatePages,
  deletePages,
  reorderPages,
  insertPagesFrom,
} from "../page-ops";
import {
  buildReviewBytes,
  buildFinalizedBytes,
  writeToPath,
  pickSavePath,
  withExtension,
} from "./persistence";
import { extractPdfText } from "../export/extract-text";
import { buildDocx } from "../export/build-docx";
import { exportPageImage } from "../export/export-image";
import { printDocument } from "./print";
import { documentReducer } from "./reducer";
import { initialDocumentState, type PageIndexMap } from "./types";

async function loadPdfAndPages(
  bytes: Uint8Array,
): Promise<{ doc: PDFDocumentProxy; pages: PDFPageProxy[] }> {
  // Pass a copy: pdf.js may transfer/detach the underlying buffer.
  const doc = await loadPdf(bytes.slice());
  const pages: PDFPageProxy[] = [];
  for (let n = 1; n <= doc.numPages; n += 1) pages.push(await doc.getPage(n));
  return { doc, pages };
}

function baseName(path: string): string {
  return path.split(/[/\\]/).pop() ?? "document.pdf";
}

export function useDocument() {
  const [state, dispatch] = useReducer(documentReducer, undefined, () =>
    initialDocumentState(),
  );

  // Mirror state into a ref so window-event listeners read the latest value.
  const stateRef = useRef(state);
  stateRef.current = state;

  // Holds the live PDFDocumentProxy for outline queries; updated on every open/edit.
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);

  const now = (): string => new Date().toISOString();
  const setBusy = (busy: boolean): void => dispatch({ type: "SET_BUSY", busy });

  // --- window title reflects dirty state ---
  useEffect(() => {
    const base = state.fileName ?? "新規ドキュメント";
    const mark = state.dirty ? " *" : "";
    void getCurrentWindow()
      .setTitle(`${base}${mark} — CivilPDF Editor`)
      .catch(() => {});
  }, [state.fileName, state.dirty]);

  // --- guard against closing with unsaved changes ---
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void getCurrentWindow()
      .onCloseRequested(async (event) => {
        if (!stateRef.current.dirty) return;
        const ok = await confirm("未保存の変更があります。破棄して閉じますか？", {
          title: "CivilPDF Editor",
          kind: "warning",
        });
        if (!ok) event.preventDefault();
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {});
    return () => unlisten?.();
  }, []);

  const open = useCallback(async (): Promise<void> => {
    const path = await dialogOpen({
      multiple: false,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!path) return;
    setBusy(true);
    try {
      const bytes = await readFile(path as string);
      const { doc, pages } = await loadPdfAndPages(bytes);
      pdfDocRef.current = doc;
      const { stamps, annotations } = await loadReviewState(bytes);
      dispatch({
        type: "OPEN_SUCCESS",
        filePath: path as string,
        fileName: baseName(path as string),
        docBytes: bytes,
        pages,
        stamps,
        annotations,
      });
    } finally {
      setBusy(false);
    }
  }, []);

  // --- non-destructive review save ---
  const persistReview = useCallback(
    async (targetPath: string): Promise<void> => {
      const s = stateRef.current;
      if (!s.docBytes) return;
      const bytes = await buildReviewBytes(
        { docBytes: s.docBytes, stamps: s.stamps, annotations: s.annotations, ocrResult: s.ocrResult },
        now(),
      );
      await writeToPath(targetPath, bytes);
      dispatch({ type: "SAVED", filePath: targetPath, fileName: baseName(targetPath) });
    },
    [],
  );

  const saveAs = useCallback(async (): Promise<void> => {
    const s = stateRef.current;
    if (!s.docBytes) return;
    const target = await pickSavePath(s.fileName ?? "document.pdf");
    if (!target) return;
    setBusy(true);
    try {
      await persistReview(target);
    } finally {
      setBusy(false);
    }
  }, [persistReview]);

  const save = useCallback(async (): Promise<void> => {
    const s = stateRef.current;
    if (!s.docBytes) return;
    if (s.filePath) {
      setBusy(true);
      try {
        await persistReview(s.filePath);
      } finally {
        setBusy(false);
      }
    } else {
      await saveAs();
    }
  }, [persistReview, saveAs]);

  // --- destructive finalize (flatten) ---
  const finalize = useCallback(async (opts: EmbedOptions = {}): Promise<void> => {
    const s = stateRef.current;
    if (!s.docBytes) return;
    const target = await pickSavePath(
      withExtension(s.fileName ?? "document.pdf", "pdf").replace(/\.pdf$/i, "-final.pdf"),
    );
    if (!target) return;
    setBusy(true);
    try {
      const bytes = await buildFinalizedBytes(
        { docBytes: s.docBytes, stamps: s.stamps, annotations: s.annotations, ocrResult: s.ocrResult },
        opts,
      );
      await writeToPath(target, bytes);
    } finally {
      setBusy(false);
    }
  }, []);

  // --- Word / image export ---
  const exportDocx = useCallback(async (): Promise<void> => {
    const s = stateRef.current;
    if (s.pages.length === 0) return;
    const target = await pickSavePath(
      withExtension(s.fileName ?? "document.pdf", "docx"),
      "docx",
      "Word",
    );
    if (!target) return;
    setBusy(true);
    try {
      const extracted = await extractPdfText(s.pages, s.ocrResult ?? undefined);
      const bytes = await buildDocx(extracted);
      await writeToPath(target, bytes);
    } finally {
      setBusy(false);
    }
  }, []);

  const exportImages = useCallback(async (): Promise<void> => {
    const s = stateRef.current;
    if (s.pages.length === 0) return;
    const base = await pickSavePath(
      withExtension(s.fileName ?? "document.pdf", "png"),
      "png",
      "PNG",
    );
    if (!base) return;
    setBusy(true);
    try {
      const stem = base.replace(/\.png$/i, "");
      for (let i = 0; i < s.pages.length; i += 1) {
        const img = await exportPageImage(s.pages[i], { type: "image/png" });
        const name = s.pages.length === 1 ? `${stem}.png` : `${stem}-p${i + 1}.png`;
        await writeToPath(name, img);
      }
    } finally {
      setBusy(false);
    }
  }, []);

  const print = useCallback(async (): Promise<void> => {
    const s = stateRef.current;
    if (s.pages.length === 0) return;
    setBusy(true);
    try {
      // Bake overlay for WYSIWYG output when present, otherwise print as-is.
      const hasOverlay = s.stamps.length > 0 || s.annotations.length > 0;
      const pages = hasOverlay && s.docBytes
        ? (await loadPdfAndPages(
            await buildFinalizedBytes({
              docBytes: s.docBytes,
              stamps: s.stamps,
              annotations: s.annotations,
              ocrResult: s.ocrResult,
            }),
          )).pages
        : s.pages;
      await printDocument(pages);
    } finally {
      setBusy(false);
    }
  }, []);

  // --- page editing (rebuild model) ---
  const applyEdit = useCallback(
    async (newBytes: Uint8Array, remap: PageIndexMap): Promise<void> => {
      const { doc, pages } = await loadPdfAndPages(newBytes);
      pdfDocRef.current = doc;
      dispatch({ type: "PAGE_EDIT", docBytes: newBytes, pages, remap });
    },
    [],
  );

  const rotate = useCallback(
    async (pageIndices: number[], delta: number): Promise<void> => {
      const s = stateRef.current;
      if (!s.docBytes || pageIndices.length === 0) return;
      setBusy(true);
      try {
        const bytes = await rotatePages(s.docBytes, pageIndices, delta);
        await applyEdit(bytes, (i) => i); // rotation keeps indices
      } finally {
        setBusy(false);
      }
    },
    [applyEdit],
  );

  const removePages = useCallback(
    async (pageIndices: number[]): Promise<void> => {
      const s = stateRef.current;
      if (!s.docBytes || pageIndices.length === 0) return;
      setBusy(true);
      try {
        const { bytes, map } = await deletePages(s.docBytes, pageIndices);
        await applyEdit(bytes, map);
      } finally {
        setBusy(false);
      }
    },
    [applyEdit],
  );

  const reorder = useCallback(
    async (newOrder: number[]): Promise<void> => {
      const s = stateRef.current;
      if (!s.docBytes) return;
      setBusy(true);
      try {
        const { bytes, map } = await reorderPages(s.docBytes, newOrder);
        await applyEdit(bytes, map);
      } finally {
        setBusy(false);
      }
    },
    [applyEdit],
  );

  const insertFromFile = useCallback(
    async (atIndex: number): Promise<void> => {
      const s = stateRef.current;
      if (!s.docBytes) return;
      const path = await dialogOpen({
        multiple: false,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!path) return;
      setBusy(true);
      try {
        const src = await readFile(path as string);
        const bytes = await insertPagesFrom(s.docBytes, src, "all", atIndex);
        await applyEdit(bytes, (i) => i);
      } finally {
        setBusy(false);
      }
    },
    [applyEdit],
  );

  // --- stamp operations ---
  const addStamp = useCallback((stamp: Stamp): void => {
    dispatch({ type: "ADD_STAMP", stamp });
  }, []);
  const updateStamp = useCallback(
    (id: string, partial: Partial<Pick<Stamp, "x" | "y" | "w">>): void => {
      dispatch({ type: "UPDATE_STAMP", id, partial });
    },
    [],
  );
  const removeStamp = useCallback((id: string): void => {
    dispatch({ type: "REMOVE_STAMP", id });
  }, []);

  // --- review operations ---
  const approve = useCallback((id: string, actor: string, comment?: string): void => {
    dispatch({ type: "APPROVE", id, actor, at: now(), comment });
  }, []);
  const reject = useCallback((id: string, actor: string, comment?: string): void => {
    dispatch({ type: "REJECT", id, actor, at: now(), comment });
  }, []);
  const comment = useCallback((id: string, actor: string, text: string): void => {
    dispatch({ type: "COMMENT", id, actor, at: now(), comment: text });
  }, []);

  // --- annotations ---
  const addAnnotation = useCallback((annot: Annotation): void => {
    dispatch({ type: "ADD_ANNOT", annot });
  }, []);
  const removeAnnotation = useCallback((id: string): void => {
    dispatch({ type: "REMOVE_ANNOT", id });
  }, []);

  // --- watermark ---
  const applyWatermark = useCallback(async (opts: WatermarkOptions): Promise<void> => {
    const s = stateRef.current;
    if (!s.docBytes) return;
    setBusy(true);
    try {
      const newBytes = await addWatermark(s.docBytes, opts);
      const { doc, pages } = await loadPdfAndPages(newBytes);
      pdfDocRef.current = doc;
      dispatch({ type: "PAGE_EDIT", docBytes: newBytes, pages, remap: (i) => i });
    } finally {
      setBusy(false);
    }
  }, []);

  // --- password-protected save-as (does not change in-memory state) ---
  const saveAsEncrypted = useCallback(async (opts: EncryptOptions): Promise<void> => {
    const s = stateRef.current;
    if (!s.docBytes) return;
    const target = await pickSavePath(
      withExtension(s.fileName ?? "document.pdf", "pdf").replace(/\.pdf$/i, "-encrypted.pdf"),
    );
    if (!target) return;
    setBusy(true);
    try {
      const encBytes = await encryptPdf(s.docBytes, opts);
      await writeToPath(target, encBytes);
    } finally {
      setBusy(false);
    }
  }, []);

  // --- metadata edit ---
  const applyMetadata = useCallback(async (meta: PdfMetadata): Promise<void> => {
    const s = stateRef.current;
    if (!s.docBytes) return;
    setBusy(true);
    try {
      const newBytes = await updatePdfMetadata(s.docBytes, meta);
      // Metadata does not change page structure; reuse existing pdfjs pages.
      dispatch({ type: "PAGE_EDIT", docBytes: newBytes, pages: s.pages, remap: (i) => i });
    } finally {
      setBusy(false);
    }
  }, []);

  // --- misc ---
  const applyOcr = useCallback((result: OcrDocumentResult): void => {
    dispatch({ type: "APPLY_OCR", result });
  }, []);
  const setScale = useCallback((scale: number): void => {
    dispatch({ type: "SET_SCALE", scale });
  }, []);
  const select = useCallback((id: string | null): void => {
    dispatch({ type: "SELECT", id });
  }, []);

  return {
    state,
    canSave: state.docBytes !== null,
    /** Live PDFDocumentProxy — updated on open/edit; used by BookmarkPanel for getOutline(). */
    get pdfDocProxy() { return pdfDocRef.current; },
    open,
    save,
    saveAs,
    finalize,
    exportDocx,
    exportImages,
    print,
    rotate,
    removePages,
    reorder,
    insertFromFile,
    addStamp,
    updateStamp,
    removeStamp,
    approve,
    reject,
    comment,
    addAnnotation,
    removeAnnotation,
    applyWatermark,
    saveAsEncrypted,
    applyMetadata,
    applyOcr,
    setScale,
    select,
  };
}

export type DocumentController = ReturnType<typeof useDocument>;
