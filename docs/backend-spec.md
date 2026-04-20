# Backend Specification

## Purpose

The backend powers file ingestion, document processing, preview generation, and export for paper-cleaner.
It must remain local-first, simple, and deterministic.

## Stack

- Python 3.14 using `python3.14 -m venv`
- FastAPI
- Pydantic
- OpenCV
- Pillow
- img2pdf
- Uvicorn (runtime)

## Responsibilities

The backend must provide:

- session creation
- multi-file upload
- document metadata storage
- automatic document detection
- manual transform updates
- tone updates
- erase-path updates
- preview rendering
- ZIP export
- PDF export
- static asset serving in production

## Non-responsibilities

The backend must not add:

- OCR
- auth
- accounts
- queues
- background worker infrastructure
- semantic content analysis

## Storage model

Use local filesystem storage.
A database is optional and not required for the base implementation.

Suggested directories:

- `data/uploads/`
- `data/rendered/previews/`
- `data/rendered/exports/`
- `data/temp/`
- `data/metadata/`

Metadata is persisted in SQLite at `data/metadata/paper_cleaner.sqlite`.
The database stores sessions and document edit metadata only; uploaded originals and rendered
previews/exports remain filesystem assets.
Existing JSON metadata under `data/metadata/sessions/` and `data/metadata/documents/` may be
imported once at startup for compatibility, but SQLite is authoritative after that import.

## Metadata model

### Session schema

Logical stored shape:

```json
{
  "id": "session_abc123",
  "created_at": "2026-04-18T12:00:00Z",
  "updated_at": "2026-04-18T12:00:00Z",
  "document_ids": ["doc_1", "doc_2"]
}
```

### Document schema

Logical stored shape:

```json
{
  "id": "doc_1",
  "session_id": "session_abc123",
  "filename": "worksheet.jpg",
  "original_path": "data/uploads/session_abc123/doc_1.jpg",
  "order_index": 0,
  "auto_corners": [
    [10, 20],
    [900, 15],
    [920, 1200],
    [0, 1220]
  ],
  "user_corners": null,
  "crop_rect": { "x": 0, "y": 0, "width": 900, "height": 1200 },
  "tone_preset": "printer_friendly",
  "brightness": 0,
  "contrast": 0,
  "erase_paths": [],
  "preview_path": "data/rendered/previews/doc_1.png"
}
```

## Canonical processing order

The backend must render documents in this order:

1. read original image
2. determine effective corners (`user_corners` else `auto_corners`)
3. perspective transform
4. crop
5. tone/enhancement
6. erase mask application
7. encode/write result

This ordering is the source of truth for preview and export.

## Service modules

Recommended backend service modules:

- `detect_document.py`
  - auto-detect likely page/document corners
- `perspective.py`
  - 4-point transform utilities
- `crop.py`
  - crop rectangle normalization and application
- `enhance.py`
  - grayscale/BW/printer-friendly presets, brightness, contrast
- `erase.py`
  - polygon-to-mask conversion and fill-white operations
- `render.py`
  - full pipeline orchestration for preview/export
- `export_pdf.py`
  - ordered PDF generation
- `export_zip.py`
  - ZIP packaging of final rendered documents
- `storage.py`
  - path and metadata persistence helpers

## API endpoints

### Sessions

#### `GET /api/sessions`

Return session history summaries sorted by most recent update.

Response:

- session id
- created/updated timestamps
- document count
- first document filename, when available

#### `POST /api/sessions`

Create a new session.

Response:

- session id
- initial empty document list

#### `GET /api/sessions/{session_id}`

Return full session state.

#### `DELETE /api/sessions/{session_id}`

Delete one session, its document metadata, its upload directory, and rendered source/preview files.

### Upload

#### `POST /api/sessions/{session_id}/documents`

Upload one or more images.

Behavior:

- save original files
- create document metadata entries
- run auto-detection for each document
- generate initial previews

Response:

- updated session state or uploaded document list

### Documents

#### `POST /api/documents/{document_id}/auto-detect`

Re-run automatic document detection.

Behavior:

- updates `auto_corners`
- does not overwrite `user_corners` unless explicitly requested

#### `POST /api/documents/{document_id}/update-transform`

Update effective transform-related data.

Request body:

- `user_corners`
- `crop_rect`

Response:

- updated document state
- refreshed preview reference

#### `POST /api/documents/{document_id}/update-tone`

Update tone settings.

Request body:

- `tone_preset`
- `brightness`
- `contrast`

Response:

- updated document state
- refreshed preview reference

#### `POST /api/documents/{document_id}/erase`

Replace or update erase paths.

Request body:

- list of polygon/path point arrays

Response:

- updated document state
- refreshed preview reference

#### `GET /api/documents/{document_id}/preview`

Return current preview image.

### Ordering

#### `POST /api/sessions/{session_id}/reorder`

Update document order.

Request body:

- ordered list of document ids

Response:

- updated session state

### Export

#### `GET /api/sessions/{session_id}/export/pdf`

Generate and return an ordered PDF.

Behavior:

- render each document at export quality
- preserve current user order
- assemble into single PDF

#### `GET /api/sessions/{session_id}/export/zip`

Generate and return a ZIP archive.

Behavior:

- render each document at export quality
- package in user-defined order

## Tone presets

At minimum define named presets such as:

- `natural`
- `grayscale`
- `high_contrast_bw`
- `printer_friendly`

These should be implemented as stable, readable transformation functions.

## Erase behavior

Erase operations are manual only.
Each erase path represents a polygon or user-drawn region.
When applied:

- convert points to image-coordinate mask
- fill selected region with white

No semantic interpretation is performed.

## Preview rendering rules

Preview generation should:

- preserve the same logical processing steps as export
- use a reduced size for speed
- be cached or overwritten locally as convenient

## Export rendering rules

Export rendering should:

- start from original input
- use the latest document metadata
- avoid needless recompression where possible
- maintain readability for printing

## Error behavior

Return clear API errors for:

- missing session/document
- invalid coordinates
- unsupported file type
- preview/export generation failure

For auto-detection failure:

- return a clear error or low-confidence result
- allow user correction rather than blocking the workflow

## Static frontend serving

In production, the backend must serve the built frontend from a static directory.
It should support SPA fallback where needed.

## Testing guidance

Useful backend test inputs:

- a straight screenshot
- a phone photo with mild skew
- a phone photo with severe perspective distortion
- an image with clutter around the page
- an image where auto-detection fails or is weak
