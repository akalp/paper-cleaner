# Follow-up Notes

## Relevant Future Phase Notes

- DONE in Phase 4: EXIF orientation policy is now explicit for persisted perspective coordinates. The app stores and edits corners in EXIF-normalized image space while original files remain unchanged on disk.
- DONE across Phases 5-7: document editing fields are no longer placeholders. `crop_rect`, tone settings, and erase paths are persisted, editable, applied in preview rendering, and included in final exports.

## Optional Later Improvements

- Add lightweight UI or component-level regression coverage for cross-mode draft preservation and crop-preview loading transitions after more editor phases land.
