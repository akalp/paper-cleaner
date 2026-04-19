import type { CropRect, Point } from "../types";

export type CropHandle = "top-left" | "top-right" | "bottom-right" | "bottom-left";

export interface CanvasViewport {
  height: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  width: number;
}

export function createCanvasViewport(
  imageWidth: number,
  imageHeight: number,
  maxWidth: number,
  maxHeight: number,
  padding = 20,
): CanvasViewport {
  const width = Math.max(maxWidth, padding * 2 + 1);
  const height = Math.max(maxHeight, padding * 2 + 1);
  const innerWidth = Math.max(width - padding * 2, 1);
  const innerHeight = Math.max(height - padding * 2, 1);
  const scale = Math.min(innerWidth / imageWidth, innerHeight / imageHeight);
  const renderedWidth = imageWidth * scale;
  const renderedHeight = imageHeight * scale;

  return {
    width,
    height,
    scale,
    offsetX: (width - renderedWidth) / 2,
    offsetY: (height - renderedHeight) / 2,
  };
}

export function imagePointToCanvasPoint(point: Point, viewport: CanvasViewport): Point {
  return [
    viewport.offsetX + point[0] * viewport.scale,
    viewport.offsetY + point[1] * viewport.scale,
  ];
}

export function canvasPointToImagePoint(point: Point, viewport: CanvasViewport): Point {
  return [
    (point[0] - viewport.offsetX) / viewport.scale,
    (point[1] - viewport.offsetY) / viewport.scale,
  ];
}

export function clampPointToImageBounds(
  point: Point,
  imageWidth: number,
  imageHeight: number,
): Point {
  return [
    Math.min(Math.max(point[0], 0), imageWidth),
    Math.min(Math.max(point[1], 0), imageHeight),
  ];
}

export function clampCropRectToBounds(
  cropRect: CropRect,
  imageWidth: number,
  imageHeight: number,
  minSize = 24,
): CropRect {
  const width = Math.min(Math.max(cropRect.width, minSize), imageWidth);
  const height = Math.min(Math.max(cropRect.height, minSize), imageHeight);
  const maxX = Math.max(imageWidth - width, 0);
  const maxY = Math.max(imageHeight - height, 0);

  return {
    x: Math.min(Math.max(cropRect.x, 0), maxX),
    y: Math.min(Math.max(cropRect.y, 0), maxY),
    width,
    height,
  };
}

export function arePointsEqual(left: Point[], right: Point[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((point, index) => {
    const candidate = right[index];
    return point[0] === candidate[0] && point[1] === candidate[1];
  });
}

function polygonSignedArea(points: Point[]): number {
  if (points.length < 3) {
    return 0;
  }

  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current[0] * next[1] - next[0] * current[1];
  }

  return area / 2;
}

function orientation(start: Point, middle: Point, end: Point): number {
  const value =
    (middle[1] - start[1]) * (end[0] - middle[0]) - (middle[0] - start[0]) * (end[1] - middle[1]);

  if (Math.abs(value) < 0.00001) {
    return 0;
  }

  return value > 0 ? 1 : 2;
}

function onSegment(start: Point, middle: Point, end: Point): boolean {
  return (
    middle[0] <= Math.max(start[0], end[0]) &&
    middle[0] >= Math.min(start[0], end[0]) &&
    middle[1] <= Math.max(start[1], end[1]) &&
    middle[1] >= Math.min(start[1], end[1])
  );
}

function segmentsIntersect(
  firstStart: Point,
  firstEnd: Point,
  secondStart: Point,
  secondEnd: Point,
) {
  const firstOrientation = orientation(firstStart, firstEnd, secondStart);
  const secondOrientation = orientation(firstStart, firstEnd, secondEnd);
  const thirdOrientation = orientation(secondStart, secondEnd, firstStart);
  const fourthOrientation = orientation(secondStart, secondEnd, firstEnd);

  if (firstOrientation !== secondOrientation && thirdOrientation !== fourthOrientation) {
    return true;
  }

  if (firstOrientation === 0 && onSegment(firstStart, secondStart, firstEnd)) {
    return true;
  }

  if (secondOrientation === 0 && onSegment(firstStart, secondEnd, firstEnd)) {
    return true;
  }

  if (thirdOrientation === 0 && onSegment(secondStart, firstStart, secondEnd)) {
    return true;
  }

  if (fourthOrientation === 0 && onSegment(secondStart, firstEnd, secondEnd)) {
    return true;
  }

  return false;
}

export function isQuadrilateralValid(points: Point[]): boolean {
  if (points.length !== 4) {
    return false;
  }

  const area = Math.abs(polygonSignedArea(points));
  if (area < 16) {
    return false;
  }

  return (
    !segmentsIntersect(points[0], points[1], points[2], points[3]) &&
    !segmentsIntersect(points[1], points[2], points[3], points[0])
  );
}

export function areCropRectsEqual(left: CropRect, right: CropRect): boolean {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  );
}

export function resizeCropRectFromHandle(
  cropRect: CropRect,
  handle: CropHandle,
  point: Point,
  imageWidth: number,
  imageHeight: number,
  minSize = 24,
): CropRect {
  const clampedPoint = clampPointToImageBounds(point, imageWidth, imageHeight);
  const leftEdge = cropRect.x;
  const topEdge = cropRect.y;
  const rightEdge = cropRect.x + cropRect.width;
  const bottomEdge = cropRect.y + cropRect.height;

  let nextLeft = leftEdge;
  let nextTop = topEdge;
  let nextRight = rightEdge;
  let nextBottom = bottomEdge;

  if (handle === "top-left") {
    nextLeft = Math.min(clampedPoint[0], rightEdge - minSize);
    nextTop = Math.min(clampedPoint[1], bottomEdge - minSize);
  } else if (handle === "top-right") {
    nextRight = Math.max(clampedPoint[0], leftEdge + minSize);
    nextTop = Math.min(clampedPoint[1], bottomEdge - minSize);
  } else if (handle === "bottom-right") {
    nextRight = Math.max(clampedPoint[0], leftEdge + minSize);
    nextBottom = Math.max(clampedPoint[1], topEdge + minSize);
  } else {
    nextLeft = Math.min(clampedPoint[0], rightEdge - minSize);
    nextBottom = Math.max(clampedPoint[1], topEdge + minSize);
  }

  return clampCropRectToBounds(
    {
      x: nextLeft,
      y: nextTop,
      width: nextRight - nextLeft,
      height: nextBottom - nextTop,
    },
    imageWidth,
    imageHeight,
    minSize,
  );
}

export function normalizeCropRect(
  cropRect: CropRect,
  imageWidth: number,
  imageHeight: number,
  minSize = 24,
): CropRect {
  const clampedRect = clampCropRectToBounds(cropRect, imageWidth, imageHeight, minSize);

  return {
    x: Math.round(clampedRect.x),
    y: Math.round(clampedRect.y),
    width: Math.round(clampedRect.width),
    height: Math.round(clampedRect.height),
  };
}

function distance(left: Point, right: Point): number {
  const deltaX = right[0] - left[0];
  const deltaY = right[1] - left[1];
  return Math.hypot(deltaX, deltaY);
}

export function buildFullCropRect(points: Point[]): CropRect {
  const width = Math.max(
    Math.round(Math.max(distance(points[0], points[1]), distance(points[3], points[2]))),
    1,
  );
  const height = Math.max(
    Math.round(Math.max(distance(points[0], points[3]), distance(points[1], points[2]))),
    1,
  );

  return {
    x: 0,
    y: 0,
    width,
    height,
  };
}
