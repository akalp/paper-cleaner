# Follow-up Notes

## Relevant Future Phase Notes

- EXIF orientation policy must be made explicit before Phase 4 or Phase 5 depend on persisted coordinates. Phase 2 previews and initial dimensions currently use EXIF-normalized image orientation while original files remain unchanged on disk.
- Phase 2 document editing fields such as `auto_corners`, `crop_rect`, tone settings, and erase paths are structural placeholders only. Later phases must not treat them as fully implemented editing behavior until the corresponding backend and frontend features are completed.
