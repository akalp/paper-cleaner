import type { CropRect, Point } from "../types";

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
  const innerWidth = Math.max(maxWidth - padding * 2, 1);
  const innerHeight = Math.max(maxHeight - padding * 2, 1);
  const scale = Math.min(innerWidth / imageWidth, innerHeight / imageHeight);
  const renderedWidth = imageWidth * scale;
  const renderedHeight = imageHeight * scale;

  return {
    width: renderedWidth + padding * 2,
    height: renderedHeight + padding * 2,
    scale,
    offsetX: (maxWidth - renderedWidth) / 2,
    offsetY: (maxHeight - renderedHeight) / 2,
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
    (middle[1] - start[1]) * (end[0] - middle[0]) -
    (middle[0] - start[0]) * (end[1] - middle[1]);

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

function segmentsIntersect(firstStart: Point, firstEnd: Point, secondStart: Point, secondEnd: Point) {
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

  return !segmentsIntersect(points[0], points[1], points[2], points[3]) &&
    !segmentsIntersect(points[1], points[2], points[3], points[0]);
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
