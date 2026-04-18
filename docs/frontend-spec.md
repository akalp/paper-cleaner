# Frontend Specification

## Purpose

The frontend is the interactive editor for paper-cleaner.
It must make per-image cleanup fast and understandable.

## Stack

- Vite
- React
- TypeScript
- react-konva / Konva

## Core responsibilities

The frontend must support:

- selecting/uploading multiple images
- viewing uploaded pages in a sidebar/list
- reordering pages
- selecting one page for editing
- editing perspective corners
- editing crop region
- choosing a tone preset
- adjusting brightness and contrast
- drawing erase polygons/paths
- preview refresh/display
- exporting current results as single images, ZIP, or PDF

## Non-goals

The frontend must not introduce:

- login/account flows
- collaboration UX
- multi-user assumptions
- “apply to all pages” flows as a default editing feature

## Application structure

A single-page app is sufficient unless a clear need emerges.

Suggested high-level layout:

- top toolbar
- left sidebar for page list
- main editor canvas
- right or bottom controls panel

## Main user flow

1. Create or start a session
2. Upload one or more images
3. Wait for automatic analysis/previews
4. Select a page
5. Adjust perspective if needed
6. Adjust crop if needed
7. Adjust tone and brightness/contrast if needed
8. Draw erase regions if needed
9. Reorder pages
10. Export single pages, ZIP, or PDF

## State model

Recommended state categories:

### App/session state

- current session id
- list of documents
- selected document id
- loading/error state

### Per-document editable state

- auto corners
- user corners
- crop rect
- tone preset
- brightness
- contrast
- erase paths
- preview url/version

### Transient editor state

- active tool (`perspective`, `crop`, `erase`, `tone`)
- active polygon drawing state
- dragging/selection state
- pending unsaved changes if relevant

## Suggested component structure

- `AppShell`
- `TopToolbar`
- `Sidebar`
- `SortablePageList`
- `PageThumbnail`
- `PageEditor`
- `CanvasStage`
- `CornerEditor`
- `CropEditor`
- `EraseEditor`
- `ToneControls`
- `ExportActions`
- `StatusBar` (optional)

## Sidebar requirements

The sidebar must:

- display all uploaded pages
- show order visually
- show thumbnails or compact preview cards
- support drag-and-drop reordering
- clearly indicate selected page

## Editor requirements

The editor must display the current page preview and support multiple tools.

### Perspective tool

- overlay four draggable corner handles
- show connecting lines/polygon
- allow saving updated corners
- allow reset to auto-detected corners

### Crop tool

- show crop rectangle over the transformed preview
- allow moving/resizing crop region
- allow reset crop

### Tone tool

- present named presets rather than exposing raw image-processing jargon
- provide brightness slider
- provide contrast slider
- update preview after changes

### Erase tool

- support user-created polygons/paths
- visualize active drawing
- save completed erase regions
- allow undo last erase
- allow clear all erase regions

## Coordinate system rules

The frontend must clearly distinguish between:

- displayed canvas coordinates
- image-space coordinates used by the backend

All edits sent to the backend must be transformed into the correct image coordinate space.
This is a critical correctness concern.

## API interaction model

The frontend should call backend APIs for canonical state changes.
It may keep temporary UI state locally during an interaction, then persist on confirmation or interaction end.

Typical flow:

- user drags points locally
- frontend computes updated coordinates
- frontend sends mutation request
- backend regenerates preview
- frontend updates displayed preview/version

## Reordering behavior

Reordering must affect:

- sidebar order
- ZIP export file order if relevant
- PDF page order

The backend is the source of truth after reorder is persisted.

## Export UX

The frontend must provide visible export actions for:

- current page image download (if implemented directly)
- session ZIP export
- session PDF export

Avoid burying exports behind deep menus.

## Visual design guidelines

This is a utility application.
Design should be:

- clean
- practical
- dense enough to be efficient
- free of unnecessary marketing-style decoration

## Accessibility and usability

At minimum:

- buttons and tool modes should have readable labels
- active tool should be obvious
- selected page should be obvious
- destructive reset/clear actions should be understandable

## Error handling

The frontend should display understandable messages for:

- upload failure
- processing failure
- preview refresh failure
- export failure

Auto-detection failure should not dead-end the user; manual editing should still be possible.
