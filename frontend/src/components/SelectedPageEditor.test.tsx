import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CropRect, DocumentResponse, ErasePath, Point } from "../types";
import { SelectedPageEditor } from "./SelectedPageEditor";

vi.mock("./PerspectiveEditorCanvas", () => ({
  PerspectiveEditorCanvas: ({
    corners,
    onCornerChange,
  }: {
    corners: Point[];
    onCornerChange: (index: number, point: Point) => void;
  }) => (
    <div data-testid="perspective-canvas" data-corners={JSON.stringify(corners)}>
      <button type="button" data-testid="drag-corner" onClick={() => onCornerChange(0, [10, 10])}>
        drag corner
      </button>
    </div>
  ),
}));

vi.mock("./CropEditorCanvas", () => ({
  CropEditorCanvas: ({ cropRect }: { cropRect: CropRect }) => (
    <div data-testid="crop-canvas" data-crop={JSON.stringify(cropRect)} />
  ),
}));

vi.mock("./EraseEditorCanvas", () => ({
  EraseEditorCanvas: ({
    erasePaths,
    onAddPoint,
  }: {
    erasePaths: ErasePath[];
    onAddPoint: (point: Point) => void;
  }) => (
    <div data-testid="erase-canvas" data-paths={JSON.stringify(erasePaths)}>
      <button type="button" data-testid="add-erase-point" onClick={() => onAddPoint([5, 5])}>
        add point
      </button>
    </div>
  ),
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

function makeMocks() {
  return {
    onSavePerspective:
      vi.fn<(documentId: string, userCorners: Point[], cropRect: CropRect) => Promise<void>>(),
    onResetPerspective: vi.fn<(documentId: string, cropRect: CropRect) => Promise<void>>(),
    onRerunAutoDetect: vi.fn<(documentId: string) => Promise<void>>(),
    onSaveCrop:
      vi.fn<
        (documentId: string, userCorners: Point[] | null, cropRect: CropRect) => Promise<void>
      >(),
    onResetCrop:
      vi.fn<
        (documentId: string, userCorners: Point[] | null, cropRect: CropRect) => Promise<void>
      >(),
    onSaveTone:
      vi.fn<
        (
          documentId: string,
          tonePreset: DocumentResponse["tone_preset"],
          brightness: number,
          contrast: number,
        ) => Promise<void>
      >(),
    onResetTone: vi.fn<(documentId: string) => Promise<void>>(),
    onSaveErase: vi.fn<(documentId: string, erasePaths: ErasePath[]) => Promise<void>>(),
  };
}

function editorElement(document: DocumentResponse, mocks = makeMocks()) {
  return (
    <SelectedPageEditor
      activeDocumentAction={null}
      document={document}
      isSessionLoading={false}
      onRerunAutoDetect={mocks.onRerunAutoDetect}
      onResetCrop={mocks.onResetCrop}
      onResetPerspective={mocks.onResetPerspective}
      onResetTone={mocks.onResetTone}
      onSaveCrop={mocks.onSaveCrop}
      onSaveErase={mocks.onSaveErase}
      onSavePerspective={mocks.onSavePerspective}
      onSaveTone={mocks.onSaveTone}
    />
  );
}

function renderEditor(document: DocumentResponse) {
  const mocks = makeMocks();
  const view = render(editorElement(document, mocks));
  return {
    ...view,
    mocks,
    rerender: (nextDocument: DocumentResponse) => view.rerender(editorElement(nextDocument, mocks)),
  };
}

function readCorners(): Point[] {
  return JSON.parse(screen.getByTestId("perspective-canvas").getAttribute("data-corners") ?? "[]");
}

describe("SelectedPageEditor", () => {
  it("rehydrates corners when server state changes for the same document", () => {
    const view = renderEditor(makeDocument());
    expect(readCorners()).toEqual([
      [0, 0],
      [100, 0],
      [100, 120],
      [0, 120],
    ]);

    const updated = makeDocument({
      preview_version: "v2",
      auto_corners: [
        [5, 5],
        [95, 5],
        [95, 115],
        [5, 115],
      ],
      user_corners: [
        [5, 5],
        [95, 5],
        [95, 115],
        [5, 115],
      ],
    });
    view.rerender(updated);
    expect(readCorners()).toEqual([
      [5, 5],
      [95, 5],
      [95, 115],
      [5, 115],
    ]);
  });

  it("preserves unsaved corner edits when switching documents and back", () => {
    const docA = makeDocument({ id: "doc_a" });
    const docB = makeDocument({ id: "doc_b", preview_version: "v2" });
    const view = renderEditor(docA);

    fireEvent.click(screen.getByTestId("drag-corner"));
    expect(readCorners()[0]).toEqual([10, 10]);

    view.rerender(docB);
    view.rerender(docA);

    expect(readCorners()[0]).toEqual([10, 10]);
  });

  it("preserves a custom crop when saving perspective", async () => {
    const view = renderEditor(makeDocument({ crop_rect: { x: 10, y: 10, width: 50, height: 60 } }));

    fireEvent.click(screen.getByTestId("drag-corner"));
    fireEvent.click(screen.getByRole("button", { name: "Save Perspective" }));

    await waitFor(() => expect(view.mocks.onSavePerspective).toHaveBeenCalled());
    const [, , cropRect] = view.mocks.onSavePerspective.mock.calls[0];
    expect(cropRect).toEqual({ x: 10, y: 10, width: 50, height: 60 });
  });

  it("keeps the crop at full bounds when saving perspective from a full-page crop", async () => {
    const view = renderEditor(makeDocument());

    fireEvent.click(screen.getByTestId("drag-corner"));
    fireEvent.click(screen.getByRole("button", { name: "Save Perspective" }));

    await waitFor(() => expect(view.mocks.onSavePerspective).toHaveBeenCalled());
    const [, , cropRect] = view.mocks.onSavePerspective.mock.calls[0];
    expect(cropRect).toEqual({ x: 0, y: 0, width: 100, height: 120 });
  });

  it("confirms before clearing all erase regions", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderEditor(makeDocument());

    fireEvent.click(screen.getByRole("tab", { name: "Erase" }));
    fireEvent.click(screen.getByTestId("add-erase-point"));
    fireEvent.click(screen.getByTestId("add-erase-point"));
    fireEvent.click(screen.getByTestId("add-erase-point"));
    fireEvent.click(screen.getByRole("button", { name: "Complete Region" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear All" }));

    expect(confirmSpy).toHaveBeenCalledWith("Clear all erase regions for this page?");
    const paths = JSON.parse(screen.getByTestId("erase-canvas").getAttribute("data-paths") ?? "[]");
    expect(paths).toHaveLength(1);
    confirmSpy.mockRestore();
  });

  it("clears erase regions after confirmation", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderEditor(makeDocument());

    fireEvent.click(screen.getByRole("tab", { name: "Erase" }));
    fireEvent.click(screen.getByTestId("add-erase-point"));
    fireEvent.click(screen.getByTestId("add-erase-point"));
    fireEvent.click(screen.getByTestId("add-erase-point"));
    fireEvent.click(screen.getByRole("button", { name: "Complete Region" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear All" }));

    const paths = JSON.parse(screen.getByTestId("erase-canvas").getAttribute("data-paths") ?? "[]");
    expect(paths).toHaveLength(0);
    confirmSpy.mockRestore();
  });

  it("completes an erase region without crypto.randomUUID (Safari insecure context)", () => {
    vi.stubGlobal("crypto", { randomUUID: undefined });
    renderEditor(makeDocument());

    fireEvent.click(screen.getByRole("tab", { name: "Erase" }));
    fireEvent.click(screen.getByTestId("add-erase-point"));
    fireEvent.click(screen.getByTestId("add-erase-point"));
    fireEvent.click(screen.getByTestId("add-erase-point"));
    fireEvent.click(screen.getByRole("button", { name: "Complete Region" }));

    const paths = JSON.parse(screen.getByTestId("erase-canvas").getAttribute("data-paths") ?? "[]");
    expect(paths).toHaveLength(1);
  });
});
