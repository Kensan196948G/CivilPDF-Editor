// DX (CivilPDF-DX approval console) connection settings, persisted in the
// webview's localStorage. The Editor is otherwise fully local; this DX
// integration is its only outbound network dependency.

export interface DxConfig {
  baseUrl: string;
  email: string;
  password: string;
}

const STORAGE_KEY = "civilpdf.dx.config";

export function loadDxConfig(): DxConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DxConfig>;
    if (
      typeof parsed?.baseUrl === "string" &&
      typeof parsed?.email === "string" &&
      typeof parsed?.password === "string"
    ) {
      return {
        baseUrl: parsed.baseUrl,
        email: parsed.email,
        password: parsed.password,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveDxConfig(config: DxConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearDxConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function isDxConfigured(): boolean {
  return loadDxConfig() !== null;
}
