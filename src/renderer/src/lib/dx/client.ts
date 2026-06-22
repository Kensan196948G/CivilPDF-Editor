import type { ReviewSidecarV1 } from "../review/schema";
import type { DxConfig } from "./config";

// API client for pushing the non-destructive review (ReviewSidecar) to the
// CivilPDF-DX approval console. The DX endpoints (api/editor.py) accept the
// `civilpdf.review/v1` payload as-is; DX requires JWT auth via FastAPI's
// OAuth2PasswordRequestForm (form-urlencoded username/password).

export interface DxTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export class DxApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "DxApiError";
  }
}

export interface DxClient {
  login(): Promise<string>;
  sendReviewSidecar(
    docId: string,
    sidecar: ReviewSidecarV1,
    token: string,
  ): Promise<void>;
  /** Convenience: login then upload in a single call. */
  syncReview(docId: string, sidecar: ReviewSidecarV1): Promise<void>;
}

/**
 * Create a DX API client. `fetchImpl` is injectable so the network layer can be
 * mocked in tests (the Editor has no axios; this uses the platform `fetch`).
 */
export function createDxClient(
  config: DxConfig,
  fetchImpl: typeof fetch = fetch,
): DxClient {
  const base = config.baseUrl.replace(/\/+$/, "");

  async function login(): Promise<string> {
    const body = new URLSearchParams();
    body.append("username", config.email);
    body.append("password", config.password);
    const res = await fetchImpl(`${base}/api/v1/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      throw new DxApiError(res.status, `DX login failed (${res.status})`);
    }
    const data = (await res.json()) as DxTokenResponse;
    return data.access_token;
  }

  async function sendReviewSidecar(
    docId: string,
    sidecar: ReviewSidecarV1,
    token: string,
  ): Promise<void> {
    const res = await fetchImpl(
      `${base}/api/v1/documents/${encodeURIComponent(docId)}/review-sidecar`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(sidecar),
      },
    );
    if (!res.ok) {
      throw new DxApiError(
        res.status,
        `ReviewSidecar upload failed (${res.status})`,
      );
    }
  }

  async function syncReview(
    docId: string,
    sidecar: ReviewSidecarV1,
  ): Promise<void> {
    const token = await login();
    await sendReviewSidecar(docId, sidecar, token);
  }

  return { login, sendReviewSidecar, syncReview };
}
