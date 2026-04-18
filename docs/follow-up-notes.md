# Follow-up Notes

## Relevant Future Phase Notes

- DONE in Phase 4: EXIF orientation policy is now explicit for persisted perspective coordinates. The app stores and edits corners in EXIF-normalized image space while original files remain unchanged on disk.
- PARTIALLY DONE in Phase 4: document editing fields are no longer placeholders for automatic detection and manual perspective correction. `crop_rect`, tone settings, and erase paths still remain structural placeholders until their corresponding phases are completed.

## Optional Later Improvements

- Add visual or manual QA coverage for corner dragging and preview refresh behavior after more editor phases land.
- Revisit frontend bundle splitting if the production bundle continues growing beyond the current Phase 4 size.
- Add a broader backend image-pipeline harness before crop, tone, and erase phases build on the same render path.
