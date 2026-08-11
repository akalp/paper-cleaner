import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PageSidebar } from "./PageSidebar";

function makeMocks() {
  return {
    onSelectDocument: vi.fn<(documentId: string) => void>(),
    onReorderDocuments: vi.fn<(documentIds: string[]) => Promise<void>>(),
  };
}

describe("PageSidebar", () => {
  it("shows skeleton rows while the session loads", () => {
    const mocks = makeMocks();
    render(
      <PageSidebar
        documents={[]}
        selectedDocumentId={null}
        hasActiveSession={false}
        isSessionLoading
        isReordering={false}
        onSelectDocument={mocks.onSelectDocument}
        onReorderDocuments={mocks.onReorderDocuments}
      />,
    );

    expect(screen.getByRole("status", { name: "Loading pages" })).toBeInTheDocument();
  });
});
