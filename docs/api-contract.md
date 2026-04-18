# API Contract Draft

## Notes

This is a practical draft contract for coordination between frontend and backend.
Names can change, but consistency matters more than exact wording.

## Session

### Create session

`POST /api/sessions`

Response:

```json
{
  "id": "session_abc123",
  "documents": []
}
```

### Get session

`GET /api/sessions/{sessionId}`

Response:

```json
{
  "id": "session_abc123",
  "documents": [
    {
      "id": "doc_1",
      "filename": "page1.jpg",
      "order_index": 0,
      "preview_url": "/api/documents/doc_1/preview",
      "transformed_preview_url": "/api/documents/doc_1/preview?stage=transformed"
    }
  ]
}
```

## Upload documents

### Upload

`POST /api/sessions/{sessionId}/documents`

Content type:

- `multipart/form-data`

Fields:

- `files`: one or more image files

Response:

```json
{
  "documents": [
    {
      "id": "doc_1",
      "filename": "page1.jpg",
      "order_index": 0,
      "auto_corners": [
        [10, 10],
        [100, 10],
        [100, 200],
        [10, 200]
      ],
      "user_corners": null,
      "crop_rect": { "x": 0, "y": 0, "width": 100, "height": 200 },
      "tone_preset": "printer_friendly",
      "brightness": 0,
      "contrast": 0,
      "erase_paths": [],
      "preview_url": "/api/documents/doc_1/preview",
      "transformed_preview_url": "/api/documents/doc_1/preview?stage=transformed"
    }
  ]
}
```

## Document updates

### Re-run auto-detect

`POST /api/documents/{documentId}/auto-detect`

Response: updated document

### Update transform

`POST /api/documents/{documentId}/update-transform`

Request:

```json
{
  "user_corners": [
    [12, 15],
    [901, 11],
    [930, 1201],
    [4, 1220]
  ],
  "crop_rect": { "x": 5, "y": 10, "width": 890, "height": 1180 }
}
```

Response: updated document

### Update tone

`POST /api/documents/{documentId}/update-tone`

Request:

```json
{
  "tone_preset": "grayscale",
  "brightness": 10,
  "contrast": 15
}
```

Response: updated document

### Update erase paths

`POST /api/documents/{documentId}/erase`

Request:

```json
{
  "erase_paths": [
    {
      "points": [
        [10, 10],
        [50, 10],
        [50, 50],
        [10, 50]
      ],
      "mode": "fill_white"
    }
  ]
}
```

Response: updated document

### Preview

`GET /api/documents/{documentId}/preview`

Returns image content.

Query parameters:

- `stage=final` returns the saved preview with crop and tone applied
- `stage=transformed` returns the perspective-corrected, uncropped preview used by crop editing

## Reordering

### Reorder session documents

`POST /api/sessions/{sessionId}/reorder`

Request:

```json
{
  "document_ids": ["doc_2", "doc_1", "doc_3"]
}
```

Response: updated session

## Export

### PDF export

`GET /api/sessions/{sessionId}/export/pdf`

Returns PDF file.

### ZIP export

`GET /api/sessions/{sessionId}/export/zip`

Returns ZIP file.
