import { contextBridge, ipcRenderer } from "electron";

export interface OpenedPdf {
  name: string;
  bytes: Uint8Array;
}

const api = {
  /** Open a PDF via the native dialog; resolves null if cancelled. */
  openPdf: (): Promise<OpenedPdf | null> => ipcRenderer.invoke("pdf:open"),
  /** Save stamped PDF bytes via the native dialog; resolves the path or null. */
  savePdf: (bytes: Uint8Array, defaultName: string): Promise<string | null> =>
    ipcRenderer.invoke("pdf:save", { bytes, defaultName }),
};

contextBridge.exposeInMainWorld("api", api);

export type Api = typeof api;
