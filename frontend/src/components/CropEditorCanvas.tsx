import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, Image as KonvaImage, Layer, Rect, Stage, Text } from "react-konva";

import type { CropRect } from "../types";
import type { CropHandle } from "../utils/perspectiveGeometry";
import {
  canvasPointToImagePoint,
  clampCropRectToBounds,
  createCanvasViewport,
  imagePointToCanvasPoint,
  resizeCropRectFromHandle,
} from "../utils/perspectiveGeometry";

const FALLBACK_CONTAINER_WIDTH = 520;
const MAX_STAGE_HEIGHT = 620;
const CROP_HANDLES: Array<{ handle: CropHandle; label: string }> = [
  { handle: "top-left", label: "TL" },
  { handle: "top-right", label: "TR" },
  { handle: "bottom-right", label: "BR" },
  { handle: "bottom-left", label: "BL" },
];

interface CropEditorCanvasProps {
  cropRect: CropRect;
  disabled: boolean;
  imageHeight: number;
  imageUrl: string;
  imageWidth: number;
  onCropRectChange: (cropRect: CropRect) => void;
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

function getCanvasCropRect(cropRect: CropRect, scale: number, offsetX: number, offsetY: number) {
  return {
    x: offsetX + cropRect.x * scale,
    y: offsetY + cropRect.y * scale,
    width: cropRect.width * scale,
    height: cropRect.height * scale,
  };
}

function getHandlePosition(cropRect: CropRect, handle: CropHandle): [number, number] {
  const right = cropRect.x + cropRect.width;
  const bottom = cropRect.y + cropRect.height;

  if (handle === "top-left") {
    return [cropRect.x, cropRect.y];
  }

  if (handle === "top-right") {
    return [right, cropRect.y];
  }

  if (handle === "bottom-right") {
    return [right, bottom];
  }

  return [cropRect.x, bottom];
}

export function CropEditorCanvas({
  cropRect,
  disabled,
  imageHeight,
  imageUrl,
  imageWidth,
  onCropRectChange,
}: CropEditorCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(FALLBACK_CONTAINER_WIDTH);
  const [activeHandleState, setActiveHandleState] = useState<{
    handle: CropHandle | null;
    imageUrl: string;
  }>({
    handle: null,
    imageUrl,
  });
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

  const canvasCropRect = useMemo(() => {
    return getCanvasCropRect(cropRect, viewport.scale, viewport.offsetX, viewport.offsetY);
  }, [cropRect, viewport.offsetX, viewport.offsetY, viewport.scale]);
  const imageRenderWidth = imageWidth * viewport.scale;
  const imageRenderHeight = imageHeight * viewport.scale;
  const activeHandle = activeHandleState.imageUrl === imageUrl ? activeHandleState.handle : null;
  const isImageLoading = loadedImage.loadedUrl !== imageUrl;

  return (
    <div ref={containerRef} className="source-editor-frame">
      {isImageLoading ? (
        <div className="editor-loading-state">
          <p>Loading transformed preview...</p>
        </div>
      ) : loadedImage.hasError ? (
        <div className="preview-error" role="alert">
          <h3>Preview unavailable</h3>
          <p>
            The transformed preview could not be loaded for crop editing. You can still switch back
            to perspective or tone while the preview reloads.
          </p>
        </div>
      ) : loadedImage.image === null ? (
        <div className="editor-loading-state">
          <p>Loading transformed preview...</p>
        </div>
      ) : (
        <Stage width={viewport.width} height={viewport.height}>
          <Layer>
            <KonvaImage
              image={loadedImage.image}
              x={viewport.offsetX}
              y={viewport.offsetY}
              width={imageRenderWidth}
              height={imageRenderHeight}
              cornerRadius={18}
            />

            <Rect
              x={viewport.offsetX}
              y={viewport.offsetY}
              width={imageRenderWidth}
              height={Math.max(canvasCropRect.y - viewport.offsetY, 0)}
              fill="rgba(26, 36, 32, 0.42)"
              listening={false}
            />
            <Rect
              x={viewport.offsetX}
              y={canvasCropRect.y}
              width={Math.max(canvasCropRect.x - viewport.offsetX, 0)}
              height={canvasCropRect.height}
              fill="rgba(26, 36, 32, 0.42)"
              listening={false}
            />
            <Rect
              x={canvasCropRect.x + canvasCropRect.width}
              y={canvasCropRect.y}
              width={Math.max(
                viewport.offsetX + imageRenderWidth - (canvasCropRect.x + canvasCropRect.width),
                0,
              )}
              height={canvasCropRect.height}
              fill="rgba(26, 36, 32, 0.42)"
              listening={false}
            />
            <Rect
              x={viewport.offsetX}
              y={canvasCropRect.y + canvasCropRect.height}
              width={imageRenderWidth}
              height={Math.max(
                viewport.offsetY + imageRenderHeight - (canvasCropRect.y + canvasCropRect.height),
                0,
              )}
              fill="rgba(26, 36, 32, 0.42)"
              listening={false}
            />

            <Rect
              x={canvasCropRect.x}
              y={canvasCropRect.y}
              width={canvasCropRect.width}
              height={canvasCropRect.height}
              fill="rgba(255, 255, 255, 0.08)"
              stroke="#d87732"
              strokeWidth={3}
              cornerRadius={12}
              draggable={!disabled}
              dragBoundFunc={(position) => {
                const maxX = viewport.offsetX + (imageWidth - cropRect.width) * viewport.scale;
                const maxY = viewport.offsetY + (imageHeight - cropRect.height) * viewport.scale;

                return {
                  x: Math.min(Math.max(position.x, viewport.offsetX), maxX),
                  y: Math.min(Math.max(position.y, viewport.offsetY), maxY),
                };
              }}
              onDragMove={(event) => {
                const nextCropRect = clampCropRectToBounds(
                  {
                    ...cropRect,
                    x: (event.target.x() - viewport.offsetX) / viewport.scale,
                    y: (event.target.y() - viewport.offsetY) / viewport.scale,
                  },
                  imageWidth,
                  imageHeight,
                );
                onCropRectChange(nextCropRect);
              }}
              onDragEnd={(event) => {
                const nextCropRect = clampCropRectToBounds(
                  {
                    ...cropRect,
                    x: (event.target.x() - viewport.offsetX) / viewport.scale,
                    y: (event.target.y() - viewport.offsetY) / viewport.scale,
                  },
                  imageWidth,
                  imageHeight,
                );
                onCropRectChange(nextCropRect);
              }}
            />

            <Text
              x={canvasCropRect.x + 12}
              y={canvasCropRect.y + 10}
              text={`${Math.round(cropRect.width)} × ${Math.round(cropRect.height)}`}
              fontFamily="IBM Plex Sans"
              fontSize={12}
              fontStyle="bold"
              fill="#1f4531"
            />

            {CROP_HANDLES.map(({ handle }) => {
              const [imageX, imageY] = getHandlePosition(cropRect, handle);
              const [x, y] = imagePointToCanvasPoint([imageX, imageY], viewport);
              const isActive = activeHandle === handle;

              return (
                <Circle
                  key={handle}
                  x={x}
                  y={y}
                  radius={isActive ? 10 : 8}
                  fill={isActive ? "#d87732" : "#22352c"}
                  stroke="#f8f6f0"
                  strokeWidth={3}
                  draggable={!disabled}
                  onDragStart={() => {
                    setActiveHandleState({ handle, imageUrl });
                  }}
                  onDragMove={(event) => {
                    onCropRectChange(
                      resizeCropRectFromHandle(
                        cropRect,
                        handle,
                        canvasPointToImagePoint([event.target.x(), event.target.y()], viewport),
                        imageWidth,
                        imageHeight,
                      ),
                    );
                  }}
                  onDragEnd={(event) => {
                    onCropRectChange(
                      resizeCropRectFromHandle(
                        cropRect,
                        handle,
                        canvasPointToImagePoint([event.target.x(), event.target.y()], viewport),
                        imageWidth,
                        imageHeight,
                      ),
                    );
                    setActiveHandleState({ handle: null, imageUrl });
                  }}
                />
              );
            })}

            {CROP_HANDLES.map(({ handle, label }) => {
              const [imageX, imageY] = getHandlePosition(cropRect, handle);
              const [x, y] = imagePointToCanvasPoint([imageX, imageY], viewport);

              return (
                <Text
                  key={`${handle}-label`}
                  x={x + 12}
                  y={y - 12}
                  text={label}
                  fontFamily="IBM Plex Sans"
                  fontSize={12}
                  fontStyle="bold"
                  fill="#1f4531"
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
