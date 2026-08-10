import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSession, deleteSession, listSessions } from "../api";
import type { SessionResponse, SessionSummary } from "../types";
import { useWorkspaceSession } from "./useWorkspaceSession";

vi.mock("../api", () => ({
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  exportDocumentImage: vi.fn(),
  exportSessionPdf: vi.fn(),
  exportSessionZip: vi.fn(),
  getSession: vi.fn(),
  listSessions: vi.fn(),
  rerunDocumentAutoDetect: vi.fn(),
  reorderSessionDocuments: vi.fn(),
  updateDocumentErase: vi.fn(),
  updateDocumentTone: vi.fn(),
  updateDocumentTransform: vi.fn(),
  uploadDocuments: vi.fn(),
}));

const STORAGE_KEY = "paper-cleaner.activeSessionId";

function makeSessionSummary(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: "s1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    document_count: 0,
    first_document_filename: null,
    ...overrides,
  };
}

function makeSession(overrides: Partial<SessionResponse> = {}): SessionResponse {
  return {
    id: "s1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    documents: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  vi.mocked(listSessions).mockResolvedValue({ sessions: [] });
});

describe("useWorkspaceSession", () => {
  it("lands without an active session when no session id is stored", async () => {
    const { result } = renderHook(() => useWorkspaceSession());

    await waitFor(() => expect(result.current.isSessionLoading).toBe(false));

    expect(result.current.session).toBeNull();
    expect(result.current.resumeSessionId).toBeNull();
    expect(result.current.sessionHistory).toEqual([]);
  });

  it("does not auto-activate the stored session and exposes it for resume", async () => {
    window.localStorage.setItem(STORAGE_KEY, "s1");
    vi.mocked(listSessions).mockResolvedValue({
      sessions: [makeSessionSummary({ id: "s1" })],
    });

    const { result } = renderHook(() => useWorkspaceSession());

    await waitFor(() => expect(result.current.isSessionLoading).toBe(false));

    expect(result.current.session).toBeNull();
    expect(result.current.resumeSessionId).toBe("s1");
  });

  it("clears a stale stored session id that no longer exists", async () => {
    window.localStorage.setItem(STORAGE_KEY, "gone");

    const { result } = renderHook(() => useWorkspaceSession());

    await waitFor(() => expect(result.current.isSessionLoading).toBe(false));

    expect(result.current.resumeSessionId).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("records the created session as the resume session", async () => {
    const created = makeSession({ id: "s2" });
    vi.mocked(createSession).mockResolvedValue(created);

    const { result } = renderHook(() => useWorkspaceSession());
    await waitFor(() => expect(result.current.isSessionLoading).toBe(false));

    await act(async () => {
      await result.current.createNewSession();
    });

    expect(result.current.session?.id).toBe("s2");
    expect(result.current.resumeSessionId).toBe("s2");
  });

  it("clears the resume session when the active session is deleted", async () => {
    const created = makeSession({ id: "s3" });
    vi.mocked(createSession).mockResolvedValue(created);
    vi.mocked(deleteSession).mockResolvedValue(undefined);

    const { result } = renderHook(() => useWorkspaceSession());
    await waitFor(() => expect(result.current.isSessionLoading).toBe(false));

    await act(async () => {
      await result.current.createNewSession();
    });

    await act(async () => {
      await result.current.removeSession("s3");
    });

    expect(result.current.session).toBeNull();
    expect(result.current.resumeSessionId).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
