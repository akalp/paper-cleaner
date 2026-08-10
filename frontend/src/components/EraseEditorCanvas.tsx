import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Circle, Image as KonvaImage, Layer, Line, Stage, Text } from "react-konva";

import { useLoadedImage } from "../hooks/useLoadedImage";
import type { ErasePath, Point } from "../types";
import {
  canvasPointToImagePoint,
  createCanvasViewport,
  imagePointToCanvasPoint,
} from "../utils/perspectiveGeometry";

const FALLBACK_CONTAINER_WIDTH = 520;
const MAX_STAGE_HEIGHT = 620;

interface EraseEditorCanvasProps {
  activePath: Point[];
  disabled: boolean;
  erasePaths: ErasePath[];
  imageHeight: number;
  imageUrl: string;
  imageWidth: number;
  onAddPoint: (point: Point) => void;
}

function getPathLabelPosition(points: Point[], fallback: Point): Point {
  if (points.length === 0) {
    return fallback;
  }

  const total = points.reduce(
    (current, point) => [current[0] + point[0], current[1] + point[1]] as Point,
    [0, 0],
  );

  return [total[0] / points.length, total[1] / points.length];
}

export function EraseEditorCanvas({
  activePath,
  disabled,
  erasePaths,
  imageHeight,
  imageUrl,
  imageWidth,
  onAddPoint,
}: EraseEditorCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(FALLBACK_CONTAINER_WIDTH);
  const [containerHeight, setContainerHeight] = useState(0);
  const loadedImage = useLoadedImage(imageUrl);

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

  const activePathPoints = useMemo(() => {
    return activePath.flatMap((point) => imagePointToCanvasPoint(point, viewport));
  }, [activePath, viewport]);
  const isImageLoading = loadedImage.loadedUrl !== imageUrl;

  return (
    <div ref={containerRef} className="source-editor-frame">
      {isImageLoading ? (
        <div className="editor-loading-state">
          <p>Loading corrected preview...</p>
        </div>
      ) : loadedImage.hasError ? (
        <div className="preview-error" role="alert">
          <h3>Preview unavailable</h3>
          <p>
            The corrected preview could not be loaded for erase editing. You can still switch back
            to perspective, crop, or tone while it reloads.
          </p>
        </div>
      ) : loadedImage.image === null ? (
        <div className="editor-loading-state">
          <p>Loading corrected preview...</p>
        </div>
      ) : (
        <Stage
          width={viewport.width}
          height={viewport.height}
          onPointerDown={(event) => {
            if (disabled) {
              return;
            }

            const pointerPosition = event.target.getStage()?.getPointerPosition();
            if (pointerPosition === null || pointerPosition === undefined) {
              return;
            }

            const imagePoint = canvasPointToImagePoint(
              [pointerPosition.x, pointerPosition.y],
              viewport,
            );
            if (
              imagePoint[0] < 0 ||
              imagePoint[1] < 0 ||
              imagePoint[0] > imageWidth ||
              imagePoint[1] > imageHeight
            ) {
              return;
            }

            onAddPoint([imagePoint[0], imagePoint[1]]);
          }}
        >
          <Layer>
            <KonvaImage
              image={loadedImage.image}
              x={viewport.offsetX}
              y={viewport.offsetY}
              width={imageWidth * viewport.scale}
              height={imageHeight * viewport.scale}
              cornerRadius={18}
            />

            {erasePaths.map((erasePath, index) => {
              const polygonPoints = erasePath.points.flatMap((point) =>
                imagePointToCanvasPoint(point, viewport),
              );
              const labelPoint = imagePointToCanvasPoint(
                getPathLabelPosition(erasePath.points, erasePath.points[0]),
                viewport,
              );

              return (
                <Fragment key={erasePath.id}>
                  <Line
                    points={polygonPoints}
                    closed
                    fill="rgba(216, 119, 50, 0.18)"
                    stroke="#d87732"
                    strokeWidth={2}
                    listening={false}
                  />
                  <Text
                    x={labelPoint[0] + 8}
                    y={labelPoint[1] - 10}
                    text={`${index + 1}`}
                    fontFamily="IBM Plex Sans"
                    fontSize={12}
                    fontStyle="bold"
                    fill="#7a4a1e"
                    listening={false}
                  />
                </Fragment>
              );
            })}

            {activePath.length >= 3 ? (
              <Line
                points={activePathPoints}
                closed
                fill="rgba(255, 255, 255, 0.85)"
                listening={false}
              />
            ) : null}

            {activePath.length >= 2 ? (
              <Line
                points={activePathPoints}
                closed={false}
                stroke="#1f4531"
                strokeWidth={2}
                dash={[8, 6]}
                listening={false}
              />
            ) : null}

            {activePath.map((point, index) => {
              const [x, y] = imagePointToCanvasPoint(point, viewport);

              return (
                <Circle
                  key={`active-point-${index}`}
                  x={x}
                  y={y}
                  radius={6}
                  fill="#22352c"
                  stroke="#f8f6f0"
                  strokeWidth={2}
                  listening={false}
                />
              );
            })}
          </Layer>
        </Stage>
      )}
    </div>
  );
}
