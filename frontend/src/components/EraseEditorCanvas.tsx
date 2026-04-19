import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Circle, Image as KonvaImage, Layer, Line, Stage, Text } from "react-konva";

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

interface LoadedImageState {
  hasError: boolean;
  image: HTMLImageElement | null;
  loadedUrl: string | null;
}

function useLoadedImage(url: string): LoadedImageState {
  const [state, setState] = useState<LoadedImageState>({
    image: null,
    hasError: false,
    loadedUrl: null,
  });

  useEffect(() => {
    let isMounted = true;

    const image = new window.Image();

    image.onload = () => {
      if (!isMounted) {
        return;
      }

      setState({
        image,
        hasError: false,
        loadedUrl: url,
      });
    };

    image.onerror = () => {
      if (!isMounted) {
        return;
      }

      setState({
        image: null,
        hasError: true,
        loadedUrl: url,
      });
    };

    image.src = url;

    return () => {
      isMounted = false;
    };
  }, [url]);

  return state;
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
  const loadedImage = useLoadedImage(imageUrl);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }

    const updateWidth = () => {
      setContainerWidth(container.clientWidth || FALLBACK_CONTAINER_WIDTH);
    };

    updateWidth();

    const resizeObserver = new ResizeObserver(updateWidth);
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
      MAX_STAGE_HEIGHT,
    );
  }, [containerWidth, imageHeight, imageWidth]);

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
          onMouseDown={(event) => {
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
                <Fragment key={`erase-path-${index}`}>
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
