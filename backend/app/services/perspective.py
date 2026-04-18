from __future__ import annotations

import math

import cv2
import numpy as np
from PIL import Image

from app.schemas.document import Point


class PerspectiveError(ValueError):
    pass


def full_image_corners(width: int, height: int) -> list[Point]:
    return [
        (0.0, 0.0),
        (float(width), 0.0),
        (float(width), float(height)),
        (0.0, float(height)),
    ]


def normalize_corners(
    corners: list[Point],
    *,
    width: int,
    height: int,
) -> list[Point]:
    if len(corners) != 4:
        raise PerspectiveError("Exactly four corner points are required.")

    normalized: list[Point] = []
    for x, y in corners:
        if not math.isfinite(x) or not math.isfinite(y):
            raise PerspectiveError("Corner coordinates must be finite numbers.")
        if x < 0 or y < 0 or x > width or y > height:
            raise PerspectiveError("Corner coordinates must stay within the EXIF-normalized image bounds.")
        normalized.append((float(x), float(y)))

    if not is_simple_quadrilateral(normalized):
        raise PerspectiveError("Corner coordinates must define a simple quadrilateral.")

    ordered = order_corners(normalized)
    if quadrilateral_area(ordered) <= 1.0:
        raise PerspectiveError("Corner coordinates must define a non-degenerate quadrilateral.")
    if not is_convex_quadrilateral(ordered):
        raise PerspectiveError("Corner coordinates must define a convex quadrilateral.")
    return ordered


def order_corners(corners: list[Point]) -> list[Point]:
    points = np.asarray(corners, dtype=np.float32)
    if points.shape != (4, 2):
        raise PerspectiveError("Exactly four corner points are required.")

    sums = points.sum(axis=1)
    diffs = np.diff(points, axis=1).reshape(4)

    top_left = points[np.argmin(sums)]
    bottom_right = points[np.argmax(sums)]
    top_right = points[np.argmin(diffs)]
    bottom_left = points[np.argmax(diffs)]

    ordered = np.asarray(
        [top_left, top_right, bottom_right, bottom_left],
        dtype=np.float32,
    )
    return [(float(x), float(y)) for x, y in ordered]


def transformed_size(corners: list[Point]) -> tuple[int, int]:
    ordered = np.asarray(order_corners(corners), dtype=np.float32)
    top_left, top_right, bottom_right, bottom_left = ordered

    width_top = np.linalg.norm(top_right - top_left)
    width_bottom = np.linalg.norm(bottom_right - bottom_left)
    height_left = np.linalg.norm(bottom_left - top_left)
    height_right = np.linalg.norm(bottom_right - top_right)

    output_width = max(int(round(float(max(width_top, width_bottom)))), 1)
    output_height = max(int(round(float(max(height_left, height_right)))), 1)
    return output_width, output_height


def apply_perspective_transform(image: Image.Image, corners: list[Point]) -> Image.Image:
    output_width, output_height = transformed_size(corners)
    source = np.asarray(order_corners(corners), dtype=np.float32)
    destination = np.asarray(
        [
            [0.0, 0.0],
            [float(output_width - 1), 0.0],
            [float(output_width - 1), float(output_height - 1)],
            [0.0, float(output_height - 1)],
        ],
        dtype=np.float32,
    )

    matrix = cv2.getPerspectiveTransform(source, destination)
    image_array = np.array(image)

    if image_array.ndim == 2:
        border_value = 255
    else:
        border_value = tuple([255] * image_array.shape[2])

    warped = cv2.warpPerspective(
        image_array,
        matrix,
        (output_width, output_height),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=border_value,
    )
    return Image.fromarray(warped)


def quadrilateral_area(corners: list[Point]) -> float:
    ordered = order_corners(corners)
    points = ordered + [ordered[0]]
    area = 0.0
    for current, nxt in zip(points, points[1:]):
        area += (current[0] * nxt[1]) - (nxt[0] * current[1])
    return abs(area) / 2.0


def is_convex_quadrilateral(corners: list[Point]) -> bool:
    ordered = order_corners(corners)
    cross_products: list[float] = []

    for index in range(4):
        first = ordered[index]
        second = ordered[(index + 1) % 4]
        third = ordered[(index + 2) % 4]
        cross_products.append(_cross_product(first, second, third))

    has_positive = any(value > 0 for value in cross_products)
    has_negative = any(value < 0 for value in cross_products)
    return not (has_positive and has_negative)


def is_simple_quadrilateral(corners: list[Point]) -> bool:
    if len(corners) != 4:
        return False

    return not (
        segments_intersect(corners[0], corners[1], corners[2], corners[3])
        or segments_intersect(corners[1], corners[2], corners[3], corners[0])
    )


def segments_intersect(
    first_start: Point,
    first_end: Point,
    second_start: Point,
    second_end: Point,
) -> bool:
    first_orientation = _orientation(first_start, first_end, second_start)
    second_orientation = _orientation(first_start, first_end, second_end)
    third_orientation = _orientation(second_start, second_end, first_start)
    fourth_orientation = _orientation(second_start, second_end, first_end)

    if first_orientation != second_orientation and third_orientation != fourth_orientation:
        return True

    if first_orientation == 0 and _on_segment(first_start, second_start, first_end):
        return True
    if second_orientation == 0 and _on_segment(first_start, second_end, first_end):
        return True
    if third_orientation == 0 and _on_segment(second_start, first_start, second_end):
        return True
    if fourth_orientation == 0 and _on_segment(second_start, first_end, second_end):
        return True

    return False


def _cross_product(first: Point, second: Point, third: Point) -> float:
    return (
        (second[0] - first[0]) * (third[1] - second[1])
        - (second[1] - first[1]) * (third[0] - second[0])
    )


def _orientation(first: Point, second: Point, third: Point) -> int:
    value = (
        (second[1] - first[1]) * (third[0] - second[0])
        - (second[0] - first[0]) * (third[1] - second[1])
    )
    if abs(value) < 0.00001:
        return 0
    return 1 if value > 0 else 2


def _on_segment(first: Point, second: Point, third: Point) -> bool:
    return (
        min(first[0], third[0]) <= second[0] <= max(first[0], third[0])
        and min(first[1], third[1]) <= second[1] <= max(first[1], third[1])
    )
