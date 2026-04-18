# AGENTS.md — frontend

## Frontend role

The frontend is an interactive local editor for document cleanup.
It must feel lightweight, direct, and utility-first.

## Frontend stack

- Vite
- React
- TypeScript
- react-konva / Konva

## Primary UI responsibilities

- multi-image upload
- page selection
- page reordering
- perspective point editing
- crop editing
- tone preset selection
- brightness/contrast adjustment
- polygon/path erase interaction
- preview refresh
- export actions

## Hard constraints

- Do not introduce authentication flows.
- Do not introduce account concepts.
- Do not add global complexity that assumes multi-user collaboration.
- Do not add unnecessary routing if a single-page app is sufficient.
- Do not auto-apply one image’s settings to all images.

## UX principles

1. **Each page is independent.**
   The user should always feel they are editing one document at a time.

2. **Auto first, manual override always available.**
   Detected corners and auto adjustments are suggestions.

3. **Non-destructive mental model.**
   Reset and undo should be understandable and safe.

4. **Direct manipulation over forms.**
   Corner editing, crop editing, and erase interactions should happen on canvas.

5. **Low-friction export.**
   Export actions should be obvious and not buried.

## Canvas interaction rules

Perspective editing:

- show four draggable corner handles
- visualize the document boundary clearly

Crop editing:

- show a crop rectangle on the transformed image
- support draggable edges/corners if implemented

Erase editing:

- support polygon/path drawing
- represent saved erase regions visibly
- allow undo last erase and reset erasures

## State management rules

Keep state simple and explicit.
A lightweight React state model is preferred unless complexity truly requires something more.
Avoid introducing heavy state libraries unless the need is obvious.

Suggested state categories:

- session state
- selected document id
- per-document editable metadata
- transient editor interaction state
- API status/loading/error state

## Component guidance

Likely useful components:

- `Sidebar`
- `SortablePageList`
- `PageThumbnail`
- `PageEditor`
- `CornerEditor`
- `CropEditor`
- `EraseEditor`
- `ToneControls`
- `TopBar` or `Toolbar`
- `ExportActions`

## Frontend-backend contract discipline

Whenever changing UI behavior that depends on API payloads:

- update types
- confirm schema compatibility
- avoid hidden assumptions

## Visual design guidance

This is a utility tool, not a marketing site.
Use a clean, dense, practical layout.
Prioritize clarity over decoration.
