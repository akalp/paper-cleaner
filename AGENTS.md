# AGENTS.md — paper-cleaner

## Project identity

**paper-cleaner** is a personal, open-source document cleaning and print-preparation tool.
It is **not** a multi-tenant product and must not evolve into one unless explicitly requested.

The tool exists to process homework or paper-like images that were captured badly, such as:

- phone camera photos of sheets
- screenshots of worksheets
- images containing perspective distortion, background clutter, or low printability

The system should automatically suggest document cleanup, while allowing the user to manually refine each image.

## Core product goals

The project must support all of the following:

- multi-image upload
- independent processing for each image
- automatic document detection per image
- manual perspective adjustment
- manual crop adjustment
- tone presets
- brightness and contrast controls
- user-controlled polygon/path erase tool that fills selected areas with white
- page reordering
- single-image export
- bulk ZIP export
- ordered PDF export

## Explicit non-goals

The following are out of scope and must not be added unless explicitly requested:

- authentication
- user accounts
- multi-user features
- persistent cloud storage
- OCR
- semantic or automatic content removal
- background workers / queues
- telemetry / analytics
- SaaS-style productization
- external service dependencies unless clearly justified

## Technical boundaries

- Frontend: **Vite + React + TypeScript + react-konva**
- Backend: **FastAPI + Python + OpenCV + Pillow + img2pdf**
- Production deployment: **single Docker container**
- Frontend must be built and served as static assets by the backend in production
- All editing must be **non-destructive**
- Original uploaded files must remain unchanged
- Per-document edits must be stored as metadata and reapplied during preview/final render

## Architecture rules

1. **Every image is independent.**
   Never assume a setting from one image should automatically apply to another.

2. **No destructive editing.**
   Do not overwrite source images.

3. **Preview and final render are separate.**
   Preview may be lower resolution; final export must use original-resolution inputs whenever practical.

4. **User intent overrides auto-detection.**
   Automatic document detection is only a starting point.

5. **Erase operations are manual only.**
   The user explicitly draws polygons/paths to remove content; removed regions are filled white.

6. **Keep the stack small.**
   Prefer straightforward local-file and JSON-based solutions over introducing databases or infrastructure.

## Delivery expectations for agents

When implementing features:

- work in small, verifiable steps
- do not introduce speculative abstractions
- do not widen scope
- keep functions and components readable
- prefer explicitness over cleverness
- document assumptions when needed
- if sandbox limits block required work, request elevated permission for the required process
- do not install packages that are not required by the project/runtime solely for control, checking, or verification

## Coding style expectations

- Keep modules cohesive and narrow in responsibility.
- Favor typed request/response contracts.
- Add comments only where they clarify non-obvious logic.
- Avoid “future-proofing” layers that solve problems this project does not have.

## Repository map

- `backend/` — FastAPI app and image processing pipeline
- `frontend/` — React app and editor UI
- `docs/` — architecture and implementation specifications
- `data/` — runtime local data directories (uploads, temp, rendered)

## Required reading order for agents

Before changing code, read:

1. `docs/architecture.md`
2. `docs/backend-spec.md`
3. `docs/frontend-spec.md`
4. `docs/docker-spec.md`
5. the local `AGENTS.md` in the area being changed

## Change policy

If you are changing both frontend and backend behavior, keep API contracts and UI state assumptions synchronized.
If a requested change conflicts with these documents, prefer the docs unless the user explicitly overrides them.

## Commit message rules

- use conventional commit messages when creating commits
- do not mention phase names in commit messages
- do not add unnecessary detail to commit messages
- if you want to add a commit body, use chained `-m` parameters because `\n` breaks the message content
