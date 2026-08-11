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
- creating, opening, and deleting sessions (persistent session history)
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
- show a thumbnail and per-row status for each page
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
- preview brightness and contrast changes live on the preview (client-side approximation)
- update the authoritative preview after saving

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

## Responsive behavior

The UI must degrade gracefully from desktop to phone viewports:

- breakpoints: tablet at `1024px`, mobile at `768px`, small mobile at `480px`,
  and a wide breakpoint at `1280px` for editor layout and header actions
- on narrow screens the editor panel is placed before the page sidebar so
  editing remains immediately reachable
- on short viewports (height at most `520px`, or at most `800px` combined
  with a width of `1024px` or less) the header and home hero compact, and
  editor/preview frames shrink so editing stays on-screen
- header actions never wrap into orphan rows: on desktop they stack on the
  right with the session navigation above the export row; from `769px` to
  `1280px` they sit on one right-aligned row beside the heading (wrapping
  below it when there is no room); on mobile they split into two rows with
  the session navigation stretched to equal halves and the export actions on
  their own row
- editor mode tabs stay on a single row and scroll horizontally when they do
  not fit
- interactive controls keep consistent sizing and at least 48px touch-target
  height on mobile
- horizontal page overflow must be prevented at every supported viewport

Loading states (skeletons) are used while session history, the page list, and
preview refreshes are pending. Transitions respect `prefers-reduced-motion`.

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
