import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { createSession, deleteSession, listSessions } from "./api";
import type { DocumentResponse, SessionResponse, SessionSummary } from "./types";

vi.mock("./api", () => ({
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

vi.mock("./components/SelectedPageEditor", () => ({
  SelectedPageEditor: () => <div data-testid="page-editor">Editor</div>,
}));

vi.mock("./components/PageSidebar", () => ({
  PageSidebar: () => <div data-testid="page-sidebar">Sidebar</div>,
}));

function makeDocument(overrides: Partial<DocumentResponse> = {}): DocumentResponse {
  return {
    id: "doc_1",
    filename: "page.png",
    order_index: 0,
    normalized_width: 100,
    normalized_height: 120,
    auto_detect_status: "detected",
    auto_corners: [
      [0, 0],
      [100, 0],
      [100, 120],
      [0, 120],
    ],
    user_corners: null,
    crop_rect: { x: 0, y: 0, width: 100, height: 120 },
    tone_preset: "printer_friendly",
    brightness: 0,
    contrast: 0,
    erase_paths: [],
    source_scale: 1,
    preview_scale: 1,
    source_url: "/source",
    preview_url: "/preview",
    transformed_preview_url: "/transformed",
    preview_version: "v1",
    ...overrides,
  };
}

function makeSession(overrides: Partial<SessionResponse> = {}): SessionResponse {
  return {
    id: "s1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    documents: [makeDocument()],
    ...overrides,
  };
}

function makeSessionSummary(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: "s1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    document_count: 1,
    first_document_filename: "page.png",
    ...overrides,
  };
}

let history: SessionSummary[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  history = [];

  vi.mocked(listSessions).mockImplementation(async () => ({ sessions: history }));
  vi.mocked(createSession).mockImplementation(async () => {
    const session = makeSession();
    history = [...history, makeSessionSummary({ id: session.id })];
    return session;
  });
  vi.mocked(deleteSession).mockImplementation(async (sessionId: string) => {
    history = history.filter((entry) => entry.id !== sessionId);
  });
});

describe("App", () => {
  it("lands on the session home view when no session is active", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "New Session" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Upload Images" })).not.toBeInTheDocument();
  });

  it("navigates to the workspace after creating a session", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "New Session" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Upload Images" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "New Session" })).not.toBeInTheDocument();
    expect(screen.getByTestId("page-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("page-editor")).toBeInTheDocument();
  });

  it("returns to the home view from the Sessions button", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "New Session" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Upload Images" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Sessions" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "New Session" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Upload Images" })).not.toBeInTheDocument();
  });

  it("stays on the home view when the active session is deleted", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "New Session" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Upload Images" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Sessions" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "New Session" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(vi.mocked(deleteSession)).toHaveBeenCalledWith("s1");
    });
    expect(screen.getByRole("button", { name: "New Session" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Upload Images" })).not.toBeInTheDocument();
    confirmSpy.mockRestore();
  });
});
