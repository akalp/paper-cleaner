import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ExportAction } from "../types";
import { WorkspaceHeader } from "./WorkspaceHeader";

function makeMocks() {
  return {
    onUploadClick: vi.fn<() => void>(),
    onNavigateHome: vi.fn<() => void>(),
    onExportCurrentDocument: vi.fn<() => Promise<void>>(),
    onExportZip: vi.fn<() => Promise<void>>(),
    onExportPdf: vi.fn<() => Promise<void>>(),
  };
}

function renderHeader(
  props: Partial<Parameters<typeof WorkspaceHeader>[0]> = {},
  mocks = makeMocks(),
) {
  return {
    mocks,
    ...render(
      <WorkspaceHeader
        isSessionLoading={false}
        isUploading={false}
        hasDocuments={false}
        selectedDocumentName={null}
        activeExportAction={null}
        onUploadClick={mocks.onUploadClick}
        onNavigateHome={mocks.onNavigateHome}
        onExportCurrentDocument={mocks.onExportCurrentDocument}
        onExportZip={mocks.onExportZip}
        onExportPdf={mocks.onExportPdf}
        {...props}
      />,
    ),
  };
}

describe("WorkspaceHeader", () => {
  it("does not render a New Session button", () => {
    renderHeader();

    expect(screen.queryByRole("button", { name: "New Session" })).not.toBeInTheDocument();
  });

  it("renders a Sessions button that navigates back home", () => {
    const mocks = makeMocks();
    renderHeader({}, mocks);

    fireEvent.click(screen.getByRole("button", { name: "Sessions" }));
    expect(mocks.onNavigateHome).toHaveBeenCalledTimes(1);
  });

  it("disables upload and export actions without documents", () => {
    renderHeader({ hasDocuments: false });

    expect(screen.getByRole("button", { name: "Upload Images" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Export Page PNG" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Export ZIP" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Export PDF" })).toBeDisabled();
  });

  it("enables session and page exports with documents and a selected page", () => {
    renderHeader({ hasDocuments: true, selectedDocumentName: "page.png" });

    expect(screen.getByRole("button", { name: "Export Page PNG" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Export ZIP" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Export PDF" })).toBeEnabled();
  });

  it("shows an uploading label while uploading", () => {
    renderHeader({ isUploading: true });

    expect(screen.getByRole("button", { name: "Uploading..." })).toBeDisabled();
  });

  it("shows exporting labels while an export is active", () => {
    renderHeader({
      hasDocuments: true,
      selectedDocumentName: "page.png",
      activeExportAction: "zip" as ExportAction,
    });

    expect(screen.getByRole("button", { name: "Exporting ZIP..." })).toBeDisabled();
  });
});
