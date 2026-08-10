import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ReactNode } from "react";
import type { Point } from "../types";
import { canvasPointToImagePoint, createCanvasViewport } from "../utils/perspectiveGeometry";
import { EraseEditorCanvas } from "./EraseEditorCanvas";

vi.mock("react-konva", () => ({
  Stage: ({ children, ...props }: { children: ReactNode }) => (
    <div data-testid="erase-stage" {...props}>
      {children}
    </div>
  ),
  Layer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Image: () => <div />,
  Line: () => <div />,
  Circle: () => <div />,
  Text: () => <div />,
}));

vi.mock("../hooks/useLoadedImage", () => ({
  useLoadedImage: (url: string) => ({ image: {}, hasError: false, loadedUrl: url }),
}));

interface StageWithPointer {
  getStage: () => { getPointerPosition: () => { x: number; y: number } };
}

describe("EraseEditorCanvas", () => {
  it("adds an erase point when the stage receives a touch pointerdown", () => {
    const onAddPoint = vi.fn<(point: Point) => void>();
    const imageWidth = 100;
    const imageHeight = 120;
    const canvasPoint: Point = [260, 310];

    render(
      <EraseEditorCanvas
        activePath={[]}
        disabled={false}
        erasePaths={[]}
        imageHeight={imageHeight}
        imageUrl="/transformed"
        imageWidth={imageWidth}
        onAddPoint={onAddPoint}
      />,
    );

    const stage = screen.getByTestId("erase-stage") as unknown as StageWithPointer;
    stage.getStage = () => ({
      getPointerPosition: () => ({ x: canvasPoint[0], y: canvasPoint[1] }),
    });

    fireEvent.pointerDown(screen.getByTestId("erase-stage"), { pointerType: "touch" });

    const viewport = createCanvasViewport(imageWidth, imageHeight, 520, 620);
    expect(onAddPoint).toHaveBeenCalledWith(canvasPointToImagePoint(canvasPoint, viewport));
  });
});
