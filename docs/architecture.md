# paper-cleaner Architecture

## Overview

paper-cleaner is a personal, open-source web tool for cleaning worksheet-like images and preparing them for printing.
It is designed for cases where source material arrives as phone photos or screenshots rather than properly scanned documents.

The system applies automatic analysis first, then lets the user refine each document manually.

## System goals

The architecture must support:

- independent per-image processing
- automatic document detection as a suggestion layer
- non-destructive editing
- interactive canvas-based manual correction
- ordered export as images, ZIP, and PDF
- simple local deployment through a single Docker container

## High-level design

The system has two runtime layers:

1. **Frontend**
   - React application built with Vite
   - Presents upload, page management, editing tools, and export actions
   - Uses a canvas-based editor via react-konva

2. **Backend**
   - FastAPI application
   - Stores session/document metadata
   - Runs image-processing operations
   - Generates previews and final exports
   - Serves frontend static assets in production

## Deployment model

Development mode:

- frontend dev server via Vite
- backend dev server via FastAPI
- API requests proxied from frontend to backend

Production mode:

- Vite frontend is built to static assets
- FastAPI serves those assets
- app runs as a single Docker container

## Core architectural principles

### 1. Non-destructive editing

Original uploaded images remain unchanged.
All edits are stored as metadata and reapplied during preview or export rendering.

### 2. Per-document independence

Every uploaded image has its own state and processing decisions.
No “apply to all” behavior is assumed.

### 3. Auto-detection is advisory

Auto-detected document corners and suggested cleanup settings are initial guesses only.
The user must be able to override them fully.

### 4. Rendering is deterministic

Given one original image and one metadata record, preview/final render should produce the same logical output, differing only in scale/quality.

### 5. Keep infrastructure minimal

Because this is a personal tool, the architecture should avoid introducing databases, queues, cloud storage, or external services unless later justified.

## Domain model

### Session

A session groups a set of uploaded images being worked on together.

Suggested fields:

- `id`
- `created_at`
- `updated_at`
- `documents`

### Document

A document represents one uploaded image and all of its editable state.

Suggested fields:

- `id`
- `session_id`
- `filename`
- `original_path`
- `order_index`
- `auto_corners`
- `user_corners`
- `crop_rect`
- `tone_preset`
- `brightness`
- `contrast`
- `erase_paths`
- `preview_path`
- `final_render_cache_path` (optional)

### Erase path

Represents a user-drawn removal region.

Suggested fields:

- `id`
- `points`
- `mode` (`fill_white`)

## Data storage strategy

A simple local filesystem structure is sufficient.

Suggested runtime directories:

- `data/uploads/`
- `data/rendered/`
- `data/temp/`
- `data/metadata/`

Metadata can be stored as JSON files per session/document.
No database is required.

## Processing architecture

The canonical image pipeline is:

1. load original image
2. detect document boundaries (auto step)
3. apply perspective transform
4. apply crop
5. apply tone and enhancement operations
6. apply erase masks
7. write preview/export output

This order should be preserved unless the docs are intentionally updated.

## Frontend architecture summary

The frontend should be organized around a single editing workspace:

- page list/sidebar
- editor canvas
- controls panel or toolbar
- export actions

Main interaction modes:

- perspective mode
- crop mode
- erase mode
- tone mode

## Backend architecture summary

The backend should be split by responsibilities:

- API routes
- schema definitions
- session/document state management
- image processing services
- export services
- static asset serving

## API shape

Suggested route groups:

- `/api/sessions`
- `/api/documents`
- `/api/export`

Mutating operations should return updated state when useful.

## Performance expectations

This is not a high-throughput service.
The architecture should optimize for simplicity and correctness rather than concurrency at scale.
However, previews should feel reasonably responsive for normal document images.

## Security model

The tool is assumed to run locally or in a trusted personal environment.
No advanced auth/security model is required beyond normal safe file handling.

## Extension boundaries

Reasonable future enhancements could include better presets or improved detection quality.
Unwanted architectural drift includes:

- OCR pipelines
- semantic object removal
- job queues
- user accounts
- cloud sync

Those should remain out of scope unless explicitly requested.
