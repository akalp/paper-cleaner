import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReactNode } from "react";
import type { Point } from "../types";
import {
  canvasPointToImagePoint,
  clampPointToImageBounds,
  createCanvasViewport,
} from "../utils/perspectiveGeometry";
import { PerspectiveEditorCanvas } from "./PerspectiveEditorCanvas";

const mocks = vi.hoisted(() => ({
  circleProps: [] as Array<Record<string, unknown>>,
  groupProps: [] as Array<Record<string, unknown>>,
}));

vi.mock("react-konva", () => ({
  Stage: ({ children }: { children: ReactNode }) => (
    <div data-testid="perspective-stage">{children}</div>
  ),
  Layer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Image: () => <div />,
  Group: (props: Record<string, unknown>) => {
    mocks.groupProps.push(props);
    return <div>{props.children as ReactNode}</div>;
  },
  Line: () => <div />,
  Circle: (props: Record<string, unknown>) => {
    mocks.circleProps.push(props);
    return <div>{props.children as ReactNode}</div>;
  },
  Text: () => <div />,
}));

vi.mock("../hooks/useLoadedImage", () => ({
  useLoadedImage: (url: string) => ({ image: {}, hasError: false, loadedUrl: url }),
}));

interface Position {
  x: number;
  y: number;
}

function createDragEvent(handlePosition: Position, evt?: { pointerType?: string }) {
  return {
    target: {
      x: () => handlePosition.x,
      y: () => handlePosition.y,
    },
    evt,
  };
}

function invokeHandler(
  props: Record<string, unknown>,
  handlerName: string,
  event: ReturnType<typeof createDragEvent>,
) {
  const handler = props[handlerName] as (event: ReturnType<typeof createDragEvent>) => void;
  act(() => {
    handler(event);
  });
}

function lensSnapshot() {
  return mocks.groupProps.filter((props) => typeof props.x === "number").slice(-2);
}

function dotCircle() {
  const circles = mocks.circleProps.slice(-6);
  return circles[circles.length - 1];
}

const CORNERS: Point[] = [
  [20, 20],
  [80, 20],
  [80, 100],
  [20, 100],
];

const IMAGE_WIDTH = 100;
const IMAGE_HEIGHT = 120;
const EXPECTED_VIEWPORT = createCanvasViewport(IMAGE_WIDTH, IMAGE_HEIGHT, 520, 620);

describe("PerspectiveEditorCanvas", () => {
  beforeEach(() => {
    mocks.circleProps.length = 0;
    mocks.groupProps.length = 0;
  });

  it("shows and moves the magnifier lens while a corner handle is dragged and hides it after", () => {
    const onCornerChange = vi.fn<(index: number, point: Point) => void>();
    const onActiveHandleChange = vi.fn<(index: number | null) => void>();

    render(
      <PerspectiveEditorCanvas
        activeHandleIndex={null}
        corners={CORNERS}
        disabled={false}
        imageHeight={IMAGE_HEIGHT}
        imageUrl="/source"
        imageWidth={IMAGE_WIDTH}
        onActiveHandleChange={onActiveHandleChange}
        onCornerChange={onCornerChange}
      />,
    );

    expect(screen.getByTestId("perspective-stage")).toBeTruthy();
    expect(lensSnapshot()).toHaveLength(0);

    const topLeftCorner = mocks.circleProps[0];
    invokeHandler(topLeftCorner, "onDragStart", createDragEvent({ x: 260, y: 310 }));

    let lensGroups = lensSnapshot();
    expect(lensGroups).toHaveLength(2);
    expect(lensGroups[0].x).toBe(260);
    expect(lensGroups[0].y).toBe(310);
    expect(lensGroups[1].scaleX).toBe(2);
    expect(lensGroups[1].scaleY).toBe(2);
    expect(onActiveHandleChange).toHaveBeenCalledWith(0);

    const lensCircles = mocks.circleProps.slice(-6);
    expect(lensCircles.filter((circle) => circle.radius === 4).length).toBe(4);
    expect(dotCircle().x).toBe(0);
    expect(dotCircle().y).toBe(0);

    mocks.groupProps.length = 0;
    invokeHandler(topLeftCorner, "onDragMove", createDragEvent({ x: 400, y: 300 }));

    lensGroups = lensSnapshot();
    expect(lensGroups).toHaveLength(2);
    expect(lensGroups[0].x).toBe(400);
    expect(lensGroups[0].y).toBe(300);

    mocks.groupProps.length = 0;
    invokeHandler(topLeftCorner, "onDragEnd", createDragEvent({ x: 400, y: 300 }));

    expect(lensSnapshot()).toHaveLength(0);
    expect(onActiveHandleChange).toHaveBeenLastCalledWith(null);
  });

  it("clamps the lens window center so the lens stays inside the stage", () => {
    const onCornerChange = vi.fn<(index: number, point: Point) => void>();
    const onActiveHandleChange = vi.fn<(index: number | null) => void>();

    render(
      <PerspectiveEditorCanvas
        activeHandleIndex={null}
        corners={CORNERS}
        disabled={false}
        imageHeight={IMAGE_HEIGHT}
        imageUrl="/source"
        imageWidth={IMAGE_WIDTH}
        onActiveHandleChange={onActiveHandleChange}
        onCornerChange={onCornerChange}
      />,
    );

    const topLeftCorner = mocks.circleProps[0];
    invokeHandler(topLeftCorner, "onDragStart", createDragEvent({ x: 5, y: 600 }));

    const lensGroups = lensSnapshot();
    expect(lensGroups[0].x).toBe(110);
    expect(lensGroups[0].y).toBe(510);
  });

  it("keeps reporting clamped corner positions while dragging", () => {
    const onCornerChange = vi.fn<(index: number, point: Point) => void>();
    const onActiveHandleChange = vi.fn<(index: number | null) => void>();

    render(
      <PerspectiveEditorCanvas
        activeHandleIndex={null}
        corners={CORNERS}
        disabled={false}
        imageHeight={IMAGE_HEIGHT}
        imageUrl="/source"
        imageWidth={IMAGE_WIDTH}
        onActiveHandleChange={onActiveHandleChange}
        onCornerChange={onCornerChange}
      />,
    );

    const topLeftCorner = mocks.circleProps[0];
    invokeHandler(topLeftCorner, "onDragStart", createDragEvent({ x: 400, y: 300 }));
    invokeHandler(topLeftCorner, "onDragMove", createDragEvent({ x: 400, y: 300 }));

    const expectedPoint = clampPointToImageBounds(
      canvasPointToImagePoint([400, 300], EXPECTED_VIEWPORT),
      IMAGE_WIDTH,
      IMAGE_HEIGHT,
    );
    expect(onCornerChange).toHaveBeenLastCalledWith(0, expectedPoint);
  });

  it("shifts the lens window above the finger on touch and pins the magnified content to the handle", () => {
    const onCornerChange = vi.fn<(index: number, point: Point) => void>();
    const onActiveHandleChange = vi.fn<(index: number | null) => void>();

    render(
      <PerspectiveEditorCanvas
        activeHandleIndex={null}
        corners={CORNERS}
        disabled={false}
        imageHeight={IMAGE_HEIGHT}
        imageUrl="/source"
        imageWidth={IMAGE_WIDTH}
        onActiveHandleChange={onActiveHandleChange}
        onCornerChange={onCornerChange}
      />,
    );

    const topLeftCorner = mocks.circleProps[0];
    invokeHandler(
      topLeftCorner,
      "onDragStart",
      createDragEvent({ x: 260, y: 310 }, { pointerType: "touch" }),
    );

    const lensGroups = lensSnapshot();
    expect(lensGroups[0].x).toBe(260);
    expect(lensGroups[0].y).toBe(170);
    expect(lensGroups[1].x).toBe(-520);
    expect(lensGroups[1].y).toBe(-620);
    expect(dotCircle().x).toBe(0);
    expect(dotCircle().y).toBe(0);
  });

  it("keeps the lens window inside the stage on touch near the top edge", () => {
    const onCornerChange = vi.fn<(index: number, point: Point) => void>();
    const onActiveHandleChange = vi.fn<(index: number | null) => void>();

    render(
      <PerspectiveEditorCanvas
        activeHandleIndex={null}
        corners={CORNERS}
        disabled={false}
        imageHeight={IMAGE_HEIGHT}
        imageUrl="/source"
        imageWidth={IMAGE_WIDTH}
        onActiveHandleChange={onActiveHandleChange}
        onCornerChange={onCornerChange}
      />,
    );

    const topLeftCorner = mocks.circleProps[0];
    invokeHandler(
      topLeftCorner,
      "onDragStart",
      createDragEvent({ x: 260, y: 100 }, { pointerType: "touch" }),
    );

    const lensGroups = lensSnapshot();
    expect(lensGroups[0].y).toBe(110);
    expect(lensGroups[1].x).toBe(-520);
    expect(lensGroups[1].y).toBe(-200);
    expect(dotCircle().x).toBe(0);
    expect(dotCircle().y).toBe(0);
  });
});
