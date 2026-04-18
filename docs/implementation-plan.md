# Implementation Plan

## Purpose

This document breaks the project into practical implementation phases for human developers or coding agents.
It is not an MVP reduction; it is an execution order for the full agreed scope.

## Phase 1 — repository foundation

Create:

- backend project skeleton
- frontend project skeleton
- Docker build skeleton

Outcome:

- repository builds structurally
- frontend and backend can start in development mode

## Phase 2 — backend core and storage

Implement:

- session creation
- local metadata persistence
- multi-file upload
- document records
- preview file serving

Outcome:

- uploaded files are stored
- documents exist as editable records

## Phase 3 — initial frontend workspace

Implement:

- shell layout
- upload flow
- sidebar page list
- selected page editor container
- basic API client/types

Outcome:

- user can upload files and browse pages in UI

## Phase 4 — automatic detection and perspective editing

Implement:

- backend auto-detection pipeline
- perspective transform utilities
- frontend corner editor
- preview refresh loop

Outcome:

- user can inspect and correct auto-detected perspective

## Phase 5 — crop and tone editing

Implement:

- crop persistence and application
- tone presets
- brightness/contrast controls
- matching preview updates

Outcome:

- user can make print-oriented cleanup adjustments

## Phase 6 — erase tool

Implement:

- polygon/path capture in frontend
- erase metadata persistence
- backend mask creation and white-fill application
- undo/reset erase interactions

Outcome:

- user can manually remove unwanted regions

## Phase 7 — ordering and export

Implement:

- drag-and-drop page ordering
- ZIP export
- PDF export in page order
- optional single-page export flow

Outcome:

- user can finalize and download results

## Phase 8 — Docker packaging and README

Implement:

- final multi-stage Dockerfile
- compose file
- setup instructions
- usage notes

Outcome:

- project runs as a single container

## Agent execution rules

When using coding agents:

- ask for one phase or sub-phase at a time
- review generated code before continuing
- avoid asking for the entire project in one step
- keep scope pinned to the documented architecture
