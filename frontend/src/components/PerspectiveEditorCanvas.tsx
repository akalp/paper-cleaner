import { useEffect, useMemo, useRef, useState } from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import { Circle, Group, Image as KonvaImage, Layer, Line, Stage, Text } from "react-konva";

import { useLoadedImage } from "../hooks/useLoadedImage";
import type { Point } from "../types";
import {
  canvasPointToImagePoint,
  clampPointToImageBounds,
  createCanvasViewport,
  imagePointToCanvasPoint,
} from "../utils/perspectiveGeometry";

const CORNER_SHORT_LABELS = ["TL", "TR", "BR", "BL"] as const;
const FALLBACK_CONTAINER_WIDTH = 520;
const MAX_STAGE_HEIGHT = 620;
const MAGNIFIER_ZOOM = 2;
const MAGNIFIER_DIAMETER = 220;
const MAGNIFIER_RADIUS = MAGNIFIER_DIAMETER / 2;
const MAGNIFIER_TOUCH_OFFSET_Y = -140;

type LensInputMode = "pointer" | "touch";

interface MagnifierLensState {
  handlePosition: { x: number; y: number };
  windowCenter: { x: number; y: number };
}

interface PerspectiveEditorCanvasProps {
  activeHandleIndex: number | null;
  corners: Point[];
  disabled: boolean;
  imageHeight: number;
  imageUrl: string;
  imageWidth: number;
  onActiveHandleChange: (index: number | null) => void;
  onCornerChange: (index: number, point: Point) => void;
}

function clampLensCenterToStage(
  position: { x: number; y: number },
  stageWidth: number,
  stageHeight: number,
  lensRadius: number,
): { x: number; y: number } {
  const minX = lensRadius;
  const minY = lensRadius;
  const maxX = Math.max(stageWidth - lensRadius, minX);
  const maxY = Math.max(stageHeight - lensRadius, minY);

  return {
    x: Math.min(Math.max(position.x, minX), maxX),
    y: Math.min(Math.max(position.y, minY), maxY),
  };
}

function getLensInputMode(event: KonvaEventObject<DragEvent>): LensInputMode {
  return (event.evt as unknown as PointerEvent | undefined)?.pointerType === "touch"
    ? "touch"
    : "pointer";
}

export function PerspectiveEditorCanvas({
  activeHandleIndex,
  corners,
  disabled,
  imageHeight,
  imageUrl,
  imageWidth,
  onActiveHandleChange,
  onCornerChange,
}: PerspectiveEditorCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(FALLBACK_CONTAINER_WIDTH);
  const [containerHeight, setContainerHeight] = useState(0);
  const [lensState, setLensState] = useState<MagnifierLensState | null>(null);
  const loadedImage = useLoadedImage(imageUrl);
  const isImageLoading = loadedImage.loadedUrl !== imageUrl;

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }

    const updateSize = (entries?: ResizeObserverEntry[]) => {
      const entry = entries?.[0];
      const contentRect = entry?.contentRect;
      setContainerWidth(contentRect?.width || container.clientWidth || FALLBACK_CONTAINER_WIDTH);
      setContainerHeight(contentRect?.height || container.clientHeight || 0);
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const viewport = useMemo(() => {
    return createCanvasViewport(
      imageWidth,
      imageHeight,
      Math.max(containerWidth, 280),
      containerHeight > 0 ? containerHeight : MAX_STAGE_HEIGHT,
    );
  }, [containerHeight, containerWidth, imageHeight, imageWidth]);

  const polygonPoints = useMemo(() => {
    return corners.flatMap((point) => imagePointToCanvasPoint(point, viewport));
  }, [corners, viewport]);

  function updateLensPosition(event: KonvaEventObject<DragEvent>) {
    const handlePosition = {
      x: event.target.x(),
      y: event.target.y(),
    };
    const verticalOffset = getLensInputMode(event) === "touch" ? MAGNIFIER_TOUCH_OFFSET_Y : 0;
    const windowCenter = clampLensCenterToStage(
      { x: handlePosition.x, y: handlePosition.y + verticalOffset },
      viewport.width,
      viewport.height,
      MAGNIFIER_RADIUS,
    );

    setLensState({ handlePosition, windowCenter });
  }

  return (
    <div ref={containerRef} className="source-editor-frame">
      {isImageLoading ? (
        <div className="editor-loading-state">
          <p>Loading source image...</p>
        </div>
      ) : loadedImage.hasError ? (
        <div className="preview-error" role="alert">
          <h3>Source image unavailable</h3>
          <p>
            The original uploaded image could not be loaded for perspective editing. The transformed
            preview may still load if the backend render succeeded.
          </p>
        </div>
      ) : loadedImage.image === null ? (
        <div className="editor-loading-state">
          <p>Loading source image...</p>
        </div>
      ) : (
        <Stage width={viewport.width} height={viewport.height}>
          <Layer>
            <KonvaImage
              image={loadedImage.image}
              x={viewport.offsetX}
              y={viewport.offsetY}
              width={imageWidth * viewport.scale}
              height={imageHeight * viewport.scale}
              cornerRadius={18}
            />
            <Line
              points={polygonPoints}
              closed
              fill="rgba(39, 79, 57, 0.12)"
              stroke="#1f4531"
              strokeWidth={2}
            />

            {corners.map((corner, index) => {
              const [x, y] = imagePointToCanvasPoint(corner, viewport);
              const isActive = activeHandleIndex === index;

              return (
                <Group key={CORNER_SHORT_LABELS[index]}>
                  <Circle
                    x={x}
                    y={y}
                    radius={isActive ? 10 : 8}
                    fill={isActive ? "#c36d2a" : "#22352c"}
                    stroke="#f8f6f0"
                    strokeWidth={3}
                    draggable={!disabled}
                    onDragStart={(event) => {
                      onActiveHandleChange(index);
                      updateLensPosition(event);
                    }}
                    onDragMove={(event) => {
                      const nextImagePoint = clampPointToImageBounds(
                        canvasPointToImagePoint([event.target.x(), event.target.y()], viewport),
                        imageWidth,
                        imageHeight,
                      );
                      onCornerChange(index, nextImagePoint);
                      updateLensPosition(event);
                    }}
                    onDragEnd={(event) => {
                      const nextImagePoint = clampPointToImageBounds(
                        canvasPointToImagePoint([event.target.x(), event.target.y()], viewport),
                        imageWidth,
                        imageHeight,
                      );
                      onCornerChange(index, nextImagePoint);
                      onActiveHandleChange(null);
                      setLensState(null);
                    }}
                  />
                  <Text
                    x={x + 12}
                    y={y - 12}
                    text={CORNER_SHORT_LABELS[index]}
                    fontFamily="IBM Plex Sans"
                    fontSize={12}
                    fontStyle="bold"
                    fill="#1f4531"
                  />
                </Group>
              );
            })}

            {lensState === null ? null : (
              <Group
                listening={false}
                x={lensState.windowCenter.x}
                y={lensState.windowCenter.y}
                clipFunc={(ctx) => {
                  ctx.beginPath();
                  ctx.arc(0, 0, MAGNIFIER_RADIUS, 0, Math.PI * 2);
                  ctx.closePath();
                }}
              >
                <Group
                  scaleX={MAGNIFIER_ZOOM}
                  scaleY={MAGNIFIER_ZOOM}
                  x={-lensState.handlePosition.x * MAGNIFIER_ZOOM}
                  y={-lensState.handlePosition.y * MAGNIFIER_ZOOM}
                >
                  <KonvaImage
                    image={loadedImage.image}
                    x={viewport.offsetX}
                    y={viewport.offsetY}
                    width={imageWidth * viewport.scale}
                    height={imageHeight * viewport.scale}
                    cornerRadius={18}
                  />
                  <Line
                    points={polygonPoints}
                    closed
                    stroke="#1f4531"
                    strokeWidth={2 / MAGNIFIER_ZOOM}
                  />
                  {corners.map((corner, index) => {
                    const [x, y] = imagePointToCanvasPoint(corner, viewport);
                    const isActive = activeHandleIndex === index;

                    return (
                      <Circle
                        key={CORNER_SHORT_LABELS[index]}
                        x={x}
                        y={y}
                        radius={(isActive ? 10 : 8) / MAGNIFIER_ZOOM}
                        fill={isActive ? "#c36d2a" : "#22352c"}
                        stroke="#f8f6f0"
                        strokeWidth={3 / MAGNIFIER_ZOOM}
                        listening={false}
                      />
                    );
                  })}
                </Group>
                <Circle
                  x={0}
                  y={0}
                  radius={MAGNIFIER_RADIUS}
                  fill="rgba(255, 255, 255, 0.08)"
                  stroke="#1f4531"
                  strokeWidth={4}
                  listening={false}
                />
                <Circle x={0} y={0} radius={2.5} fill="#d87732" listening={false} />
              </Group>
            )}
          </Layer>
        </Stage>
      )}
    </div>
  );
}
