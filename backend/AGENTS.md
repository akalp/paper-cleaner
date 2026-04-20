# AGENTS.md — backend

## Backend role

The backend provides:

- upload/session/document APIs
- automatic document analysis
- transformation and enhancement operations
- preview generation
- ZIP/PDF export
- static serving of the frontend build in production

## Backend stack

- Python 3.14 using `python3.14 -m venv`
- FastAPI
- Pydantic
- OpenCV
- Pillow
- img2pdf

## Hard constraints

- Do not introduce an external database service.
- Prefer local filesystem assets + local SQLite metadata storage.
- Do not add Celery, Redis, RabbitMQ, or background queues.
- Do not add OCR.
- Do not add automatic semantic content removal.
- Do not mutate original uploads.

## Data model principles

Each uploaded image belongs to a session and has independent metadata.
Document edits must be represented in metadata, not baked into the source file.

Expected editable state includes:

- detected corners
- user-corrected corners
- crop rectangle
- tone preset
- brightness
- contrast
- erase paths/polygons
- order index

## Rendering principles

Maintain two render modes:

- preview render: optimized for interactivity
- export render: optimized for final output quality

A preview must represent the same logical operations as export, only at lower resolution.

## API design rules

- Use `/api/...` routes.
- Keep request/response schemas explicit.
- Return document/session state after mutating operations whenever practical.
- Prefer idempotent update semantics when possible.

## Processing pipeline rules

The canonical processing order is:

1. load original image
2. perspective transform
3. crop
4. tone/enhancement operations
5. erase-mask application
6. render/export

Do not reorder these unless explicitly justified and reflected in docs.

## File handling rules

Use clearly separated directories for:

- uploads
- temp artifacts
- rendered previews/exports
- metadata

Do not assume files must survive forever.
This is a personal local tool, not an archival system.

## Error handling

- Fail clearly when image analysis cannot detect a document.
- Return useful defaults or partial state when possible.
- Never silently substitute surprising behavior.

## Implementation expectations

Prefer small service modules, for example:

- `detect_document.py`
- `perspective.py`
- `crop.py`
- `enhance.py`
- `erase.py`
- `render.py`
- `export_pdf.py`

Avoid large “god modules”.

## Testing expectations

At minimum, backend changes should be easy to validate with:

- one camera photo
- one screenshot
- one difficult case with bad perspective or clutter
