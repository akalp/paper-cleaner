from __future__ import annotations

import math

from PIL import Image, ImageDraw

from app.schemas.document import ErasePath, Point


class EraseError(Exception):
    pass


class EraseService:
    def validate_erase_paths(
        self,
        erase_paths: list[ErasePath],
        *,
        image_width: int,
        image_height: int,
    ) -> list[ErasePath]:
        validated_paths: list[ErasePath] = []

        for path_index, erase_path in enumerate(erase_paths):
            points = [self._validate_point(point, path_index, image_width, image_height) for point in erase_path.points]
            if abs(self._polygon_signed_area(points)) < 1:
                raise EraseError(
                    f"Erase path {path_index + 1} must define a non-degenerate polygon."
                )

            validated_paths.append(
                ErasePath(
                    points=points,
                    mode=erase_path.mode,
                )
            )

        return validated_paths

    def apply_erase_paths(
        self,
        image: Image.Image,
        erase_paths: list[ErasePath],
    ) -> Image.Image:
        if not erase_paths:
            return image

        erased_image = image.copy()
        drawer = ImageDraw.Draw(erased_image)
        fill = self._white_fill(erased_image)

        for erase_path in erase_paths:
            drawer.polygon(erase_path.points, fill=fill)

        return erased_image

    def _validate_point(
        self,
        point: Point,
        path_index: int,
        image_width: int,
        image_height: int,
    ) -> Point:
        x, y = point
        if not math.isfinite(x) or not math.isfinite(y):
            raise EraseError(
                f"Erase path {path_index + 1} contains non-finite coordinates."
            )

        if x < 0 or y < 0 or x > image_width or y > image_height:
            raise EraseError(
                f"Erase path {path_index + 1} must stay within the cropped image bounds."
            )

        return (float(x), float(y))

    def _polygon_signed_area(self, points: list[Point]) -> float:
        area = 0.0
        for index, current in enumerate(points):
            following = points[(index + 1) % len(points)]
            area += current[0] * following[1] - following[0] * current[1]
        return area / 2.0

    def _white_fill(self, image: Image.Image):
        if image.mode == "L":
            return 255
        if image.mode == "LA":
            return (255, 255)
        if image.mode == "RGBA":
            return (255, 255, 255, 255)
        if image.mode == "1":
            return 1
        return (255, 255, 255)


erase_service = EraseService()
