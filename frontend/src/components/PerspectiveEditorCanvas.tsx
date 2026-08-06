import { useEffect, useMemo, useRef, useState } from "react";
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
  const loadedImage = useLoadedImage(imageUrl);
  const isImageLoading = loadedImage.loadedUrl !== imageUrl;

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }

    const updateSize = () => {
      setContainerWidth(container.clientWidth || FALLBACK_CONTAINER_WIDTH);
      setContainerHeight(container.clientHeight || 0);
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
                    onDragStart={() => {
                      onActiveHandleChange(index);
                    }}
                    onDragMove={(event) => {
                      const nextImagePoint = clampPointToImageBounds(
                        canvasPointToImagePoint([event.target.x(), event.target.y()], viewport),
                        imageWidth,
                        imageHeight,
                      );
                      onCornerChange(index, nextImagePoint);
                    }}
                    onDragEnd={(event) => {
                      const nextImagePoint = clampPointToImageBounds(
                        canvasPointToImagePoint([event.target.x(), event.target.y()], viewport),
                        imageWidth,
                        imageHeight,
                      );
                      onCornerChange(index, nextImagePoint);
                      onActiveHandleChange(null);
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
          </Layer>
        </Stage>
      )}
    </div>
  );
}
