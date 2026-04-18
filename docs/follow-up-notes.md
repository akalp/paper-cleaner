# Follow-up Notes

## Relevant Future Phase Notes

- DONE in Phase 4: EXIF orientation policy is now explicit for persisted perspective coordinates. The app stores and edits corners in EXIF-normalized image space while original files remain unchanged on disk.
- PARTIALLY DONE in Phase 4: document editing fields are no longer placeholders for automatic detection and manual perspective correction. `crop_rect`, tone settings, and erase paths still remain structural placeholders until their corresponding phases are completed.

## Optional Later Improvements

- Add lightweight UI or component-level regression coverage for cross-mode draft preservation and crop-preview loading transitions after more editor phases land.
