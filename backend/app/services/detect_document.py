from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np
from PIL import Image

from app.schemas.document import AutoDetectStatus, Point
from app.services.perspective import full_image_corners, order_corners


@dataclass(slots=True)
class DetectionResult:
    corners: list[Point]
    status: AutoDetectStatus


class DetectDocumentService:
    def detect(self, image: Image.Image) -> DetectionResult:
        rgb_image = image.convert("RGB")
        image_array = np.asarray(rgb_image)
        grayscale = cv2.cvtColor(image_array, cv2.COLOR_RGB2GRAY)
        blurred = cv2.GaussianBlur(grayscale, (5, 5), 0)

        edges = cv2.Canny(blurred, 75, 200)
        kernel = np.ones((5, 5), dtype=np.uint8)
        edges = cv2.dilate(edges, kernel, iterations=1)
        edges = cv2.erode(edges, kernel, iterations=1)

        contours, _ = cv2.findContours(
            edges,
            cv2.RETR_LIST,
            cv2.CHAIN_APPROX_SIMPLE,
        )

        image_height, image_width = grayscale.shape
        image_area = float(image_width * image_height)

        for contour in sorted(contours, key=cv2.contourArea, reverse=True):
            area = float(cv2.contourArea(contour))
            if area < image_area * 0.12:
                continue

            perimeter = cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, 0.02 * perimeter, True)
            if len(approx) != 4:
                continue

            corners = [
                self._clamp_corner(
                    float(point[0][0]),
                    float(point[0][1]),
                    image_width,
                    image_height,
                )
                for point in approx
            ]
            return DetectionResult(
                corners=order_corners(corners),
                status=AutoDetectStatus.DETECTED,
            )

        if contours:
            largest_contour = max(contours, key=cv2.contourArea)
            largest_area = float(cv2.contourArea(largest_contour))
            if largest_area >= image_area * 0.12:
                rect = cv2.minAreaRect(largest_contour)
                box = cv2.boxPoints(rect)
                corners = [
                    self._clamp_corner(float(x), float(y), image_width, image_height)
                    for x, y in box
                ]
                return DetectionResult(
                    corners=order_corners(corners),
                    status=AutoDetectStatus.DETECTED,
                )

        return DetectionResult(
            corners=full_image_corners(image_width, image_height),
            status=AutoDetectStatus.FALLBACK_FULL_IMAGE,
        )

    def _clamp_corner(
        self,
        x: float,
        y: float,
        image_width: int,
        image_height: int,
    ) -> Point:
        return (
            min(max(x, 0.0), float(image_width)),
            min(max(y, 0.0), float(image_height)),
        )


detect_document_service = DetectDocumentService()
