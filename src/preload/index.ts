import { contextBridge, ipcRenderer } from "electron";

export interface OpenedPdf {
  name: string;
  bytes: Uint8Array;
}

const api = {
  /** Open a PDF via the native dialog; resolves null if cancelled. */
  openPdf: (): Promise<OpenedPdf | null> => ipcRenderer.invoke("pdf:open"),
};

contextBridge.exposeInMainWorld("api", api);

export type Api = typeof api;
