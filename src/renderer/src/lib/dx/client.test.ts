import { describe, it, expect, vi } from "vitest";
import { createDxClient, DxApiError } from "./client";
import type { DxConfig } from "./config";
import type { ReviewSidecarV1 } from "../review/schema";

const config: DxConfig = {
  baseUrl: "http://dx.example.local:8000",
  email: "reviewer@example.com",
  password: "secret",
};

const sidecar: ReviewSidecarV1 = {
  schema: "civilpdf.review/v1",
  generator: "CivilPDF-Editor",
  savedAt: "2026-06-22T10:00:00Z",
  stamps: [],
  annotations: [],
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe("createDxClient", () => {
  it("login posts form-urlencoded credentials and returns the access token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        access_token: "tok-123",
        refresh_token: "r",
        token_type: "bearer",
      }),
    );
    const client = createDxClient(config, fetchMock);
    const token = await client.login();
    expect(token).toBe("tok-123");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://dx.example.local:8000/api/v1/auth/token");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    // OAuth2 form field is "username" (carries the email).
    expect(String(init.body)).toContain("username=reviewer%40example.com");
  });

  it("login throws DxApiError on non-2xx", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, false, 401));
    const client = createDxClient(config, fetchMock);
    await expect(client.login()).rejects.toBeInstanceOf(DxApiError);
  });

  it("sendReviewSidecar posts the civilpdf.review/v1 payload with a bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, true, 200));
    const client = createDxClient(config, fetchMock);
    await client.sendReviewSidecar("doc-1", sidecar, "tok-123");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://dx.example.local:8000/api/v1/documents/doc-1/review-sidecar",
    );
    expect(init.headers.Authorization).toBe("Bearer tok-123");
    expect(JSON.parse(init.body).schema).toBe("civilpdf.review/v1");
  });

  it("sendReviewSidecar throws DxApiError on failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, false, 403));
    const client = createDxClient(config, fetchMock);
    await expect(
      client.sendReviewSidecar("doc-1", sidecar, "tok"),
    ).rejects.toBeInstanceOf(DxApiError);
  });

  it("syncReview logs in then uploads, threading the obtained token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: "tok-xyz",
          refresh_token: "r",
          token_type: "bearer",
        }),
      )
      .mockResolvedValueOnce(jsonResponse({}, true, 200));
    const client = createDxClient(config, fetchMock);
    await client.syncReview("doc-9", sidecar);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondInit = fetchMock.mock.calls[1][1];
    expect(secondInit.headers.Authorization).toBe("Bearer tok-xyz");
  });

  it("normalizes trailing slashes in baseUrl", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        access_token: "t",
        refresh_token: "r",
        token_type: "bearer",
      }),
    );
    const client = createDxClient(
      { ...config, baseUrl: "http://dx.example.local:8000///" },
      fetchMock,
    );
    await client.login();
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://dx.example.local:8000/api/v1/auth/token",
    );
  });
});
