import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SessionSummary } from "../types";
import { SessionHomeView } from "./SessionHomeView";

function makeSessionSummary(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: "s1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    document_count: 2,
    first_document_filename: "homework.png",
    ...overrides,
  };
}

function makeMocks() {
  return {
    onCreateSession: vi.fn<() => Promise<void>>(),
    onOpenSession: vi.fn<(sessionId: string) => Promise<void>>(),
    onDeleteSession: vi.fn<(sessionId: string) => Promise<void>>(),
  };
}

function renderView(
  props: Partial<Parameters<typeof SessionHomeView>[0]> = {},
  mocks = makeMocks(),
) {
  return {
    mocks,
    ...render(
      <SessionHomeView
        sessions={[]}
        resumeSession={null}
        activeSessionId={null}
        isSessionLoading={false}
        isCreatingSession={false}
        deletingSessionId={null}
        onCreateSession={mocks.onCreateSession}
        onOpenSession={mocks.onOpenSession}
        onDeleteSession={mocks.onDeleteSession}
        {...props}
      />,
    ),
  };
}

describe("SessionHomeView", () => {
  it("renders the home hero and a New Session call to action", () => {
    renderView();

    expect(screen.getByRole("heading", { name: "paper-cleaner" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Session" })).toBeInTheDocument();
  });

  it("invokes onCreateSession when the New Session button is clicked", () => {
    const mocks = makeMocks();
    renderView({}, mocks);

    fireEvent.click(screen.getByRole("button", { name: "New Session" }));
    expect(mocks.onCreateSession).toHaveBeenCalledTimes(1);
  });

  it("shows a resume card for the resume session and opens it on click", () => {
    const resumeSession = makeSessionSummary({ id: "s9" });
    const mocks = makeMocks();
    renderView({ resumeSession }, mocks);

    expect(screen.getByText("homework.png")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(mocks.onOpenSession).toHaveBeenCalledWith("s9");
  });

  it("hides the resume card when there is no resume session", () => {
    renderView({ resumeSession: null });

    expect(screen.queryByRole("button", { name: "Resume" })).not.toBeInTheDocument();
  });

  it("lists sessions from history and deletes one after confirmation", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const mocks = makeMocks();
    renderView(
      { sessions: [makeSessionSummary({ id: "s1" }), makeSessionSummary({ id: "s2" })] },
      mocks,
    );

    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    fireEvent.click(deleteButtons[0]);

    expect(mocks.onDeleteSession).toHaveBeenCalledWith("s1");
    confirmSpy.mockRestore();
  });

  it("shows a loading state while session history loads", () => {
    renderView({ isSessionLoading: true });

    expect(screen.getByRole("heading", { name: "Preparing workspace" })).toBeInTheDocument();
  });

  it("labels the New Session button as creating while a session is created", () => {
    renderView({ isCreatingSession: true });

    const button = screen.getByRole("button", { name: "Creating..." });
    expect(button).toBeDisabled();
  });
});
