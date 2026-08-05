# Remediation Plan

Implementation plan for the findings cataloged in `analysis-report/08-findings-and-recommendations.md`
(at commit `b2ae660`). Status is tracked per phase below; update this file as items land.

## Locked decisions

- Scope includes the appendix observations (A/B/C), bundled into the relevant phases.
- Frontend gets a test runner: Vitest + `@testing-library/react` + jsdom.
- M2: add scale factors to the document payload and document them.
- M7: debounced client-side tone approximation; Save stays authoritative.
- M5/A4: perspective changes preserve the crop (re-clamped) and erase regions.
- M9: per-document draft cache; no prompts.
- Plan artifact lives here, at `docs/remediation-plan.md`.

## Phase 1 — Backend security

| Finding | Task | Status |
| --- | --- | --- |
| H1 + M1 | Rework SPA handler in `app/main.py`: resolve + containment check; JSON 404 for unmatched `/api/*` | done |
| H2 | Path-safety guard for stored `original_path`/`preview_path`; validate legacy import | done |
| tests | SPA traversal probe, `/api/*` 404, legacy traversal rejection, no escape on regenerate/delete | done (39 backend tests pass) |

## Phase 2 — Frontend data integrity + Vitest

| Finding | Task | Status |
| --- | --- | --- |
| setup | Vitest + Testing Library; `pnpm test` | done |
| H3 | Durable hydration signal; remove dead `switch`/reducer cases | done |
| M5 | Preserve crop on perspective save (re-clamp) | done |
| M9 | Per-document draft cache | done |
| M4 | Confirm before Clear All / Reset Erase | done |
| B1 | Serialize in-flight mutations; disable tool buttons while pending | done |
| B2 | No unhandled rejections from `refreshSessionHistory` | done |

Regression tests added in `frontend/src/components/SelectedPageEditor.test.tsx`
(H3, M5, M9, M4). `pnpm lint`, `pnpm test` (8), `pnpm build` all pass.

## Phase 3 — Backend correctness & performance

| Finding | Task | Status |
| --- | --- | --- |
| M2 | Add `source_scale`/`preview_scale` to payload; document; >1600px test | |
| M3 | Downscale before pipeline in preview; cache `stage=transformed` | |
| M8 | Atomic upload (transaction + rollback) | |
| A4 | Preserve erase regions on perspective/crop change | |
| A1-A3 | `enhance.py` guards + `_lift_paper_background` naming | |
| A5 | Re-validate legacy erase paths on load | |
| A6 | `GET /preview` pure (404 on cache miss) | |
| A7 | Empty upload returns documented 400 | |
| A8 | Normalize timestamp format | |
| C4/C1-C3 | Missing tests + test hygiene | |

## Phase 4 — Frontend UX & polish

| Finding | Task | Status |
| --- | --- | --- |
| M6 | Page thumbnails + truthful status | |
| M7 | Live tone preview (client-side approximation) | |
| L1+B10 | Dismissible banners, per-action retry, success feedback | |
| L2 | Delayed `revokeObjectURL` | |
| L3 | Shared `useLoadedImage` with `loadedUrl` gate | |
| L4 | Load or drop referenced fonts | |
| L5 | `:focus-visible`, tablist arrows, `prefers-reduced-motion` | |
| L6 | Crop readout contrast shield | |
| L7 | Erase ergonomics (remove-last-point, Escape, in-progress fill) | |
| L8 | Upload size/count limits; guard `delete_session` path | |
| L9 | Logging in error paths | |
| L10+B8 | Dead code + phase classes removal | |
| B3-B6, B9 | Clamp, `dragBoundFunc`, vertical fit, origin-safe URLs, session label | |
| ErasePath.id | Add `id` to schema + frontend; key regions by id | |

## Phase 5 — Docs & finalize

- `api-contract.md`: `source` + `export/image`, scale factors, timestamps, 400-vs-422.
- `backend-spec.md`: remove stale "database optional"; add session history; A4 semantics.
- `frontend-spec.md`: session history; thumbnails + live tone preview.
- `architecture.md`: `ErasePath.id`; resolve `final_render_cache_path`.
- Full verification: `pytest`; `pnpm test && pnpm lint && pnpm format:check && pnpm build`; `docker compose config`.
