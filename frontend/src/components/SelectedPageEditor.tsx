import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import type {
  ActiveDocumentAction,
  CropRect,
  DocumentResponse,
  ErasePath,
  Point,
  TonePreset,
} from "../types";
import {
  areCropRectsEqual,
  arePointsEqual,
  buildFullCropRect,
  isQuadrilateralValid,
  normalizeCropRect,
} from "../utils/perspectiveGeometry";
import { CropEditorCanvas } from "./CropEditorCanvas";
import { EmptyPanel } from "./EmptyPanel";
import { EraseEditorCanvas } from "./EraseEditorCanvas";
import { PerspectiveEditorCanvas } from "./PerspectiveEditorCanvas";
import { ToneControls } from "./ToneControls";

type EditorMode = "perspective" | "crop" | "tone" | "erase";

const DEFAULT_TONE_PRESET: TonePreset = "printer_friendly";
const DEFAULT_TONE_BRIGHTNESS = 0;
const DEFAULT_TONE_CONTRAST = 0;
const EMPTY_CROP_RECT: CropRect = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
};

interface SelectedPageEditorProps {
  document: DocumentResponse | null;
  isSessionLoading: boolean;
  activeDocumentAction: ActiveDocumentAction | null;
  onSavePerspective: (documentId: string, userCorners: Point[], cropRect: CropRect) => Promise<void>;
  onResetPerspective: (documentId: string, cropRect: CropRect) => Promise<void>;
  onRerunAutoDetect: (documentId: string) => Promise<void>;
  onSaveCrop: (
    documentId: string,
    userCorners: Point[] | null,
    cropRect: CropRect,
  ) => Promise<void>;
  onResetCrop: (
    documentId: string,
    userCorners: Point[] | null,
    cropRect: CropRect,
  ) => Promise<void>;
  onSaveTone: (
    documentId: string,
    tonePreset: TonePreset,
    brightness: number,
    contrast: number,
  ) => Promise<void>;
  onResetTone: (documentId: string) => Promise<void>;
  onSaveErase: (documentId: string, erasePaths: ErasePath[]) => Promise<void>;
}

function getEffectiveCorners(document: DocumentResponse): Point[] {
  return document.user_corners ?? document.auto_corners;
}

function formatDetectStatus(status: DocumentResponse["auto_detect_status"]): string {
  if (status === "detected") {
    return "Detected";
  }

  return "Fallback";
}

function formatTonePresetLabel(tonePreset: TonePreset): string {
  if (tonePreset === "high_contrast_bw") {
    return "High Contrast B/W";
  }

  return tonePreset
    .split("_")
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatAdjustment(value: number): string {
  if (value > 0) {
    return `+${value}`;
  }

  return `${value}`;
}

function formatEraseCount(count: number): string {
  if (count === 1) {
    return "1 region";
  }

  return `${count} regions`;
}

function areErasePathsEqual(left: ErasePath[], right: ErasePath[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((leftPath, index) => {
    const rightPath = right[index];
    if (leftPath.mode !== rightPath.mode || leftPath.points.length !== rightPath.points.length) {
      return false;
    }

    return leftPath.points.every((point, pointIndex) => {
      const candidate = rightPath.points[pointIndex];
      return point[0] === candidate[0] && point[1] === candidate[1];
    });
  });
}

interface EditorDraftState {
  activeErasePoints: Point[];
  activePerspectiveHandleIndex: number | null;
  brightness: number;
  contrast: number;
  corners: Point[];
  cropRect: CropRect;
  erasePaths: ErasePath[];
  tonePreset: TonePreset;
}

type EditorDraftAction =
  | { type: "clear" }
  | { type: "hydrate-all"; document: DocumentResponse }
  | { type: "hydrate-perspective-crop-erase"; document: DocumentResponse }
  | { type: "hydrate-crop-erase"; document: DocumentResponse }
  | { type: "hydrate-tone"; document: DocumentResponse }
  | { type: "hydrate-erase"; document: DocumentResponse }
  | { type: "update-corner"; index: number; point: Point }
  | { type: "set-crop-rect"; cropRect: CropRect }
  | { type: "set-tone-preset"; tonePreset: TonePreset }
  | { type: "set-brightness"; brightness: number }
  | { type: "set-contrast"; contrast: number }
  | { type: "set-active-perspective-handle"; index: number | null }
  | { type: "reset-perspective-local"; corners: Point[] }
  | { type: "reset-crop-local"; cropRect: CropRect }
  | { type: "reset-tone-local" }
  | { type: "add-erase-point"; point: Point }
  | { type: "complete-erase-region" }
  | { type: "cancel-erase-region" }
  | { type: "undo-last-erase" }
  | { type: "clear-erase" };

const EMPTY_DRAFT_STATE: EditorDraftState = {
  activeErasePoints: [],
  activePerspectiveHandleIndex: null,
  brightness: DEFAULT_TONE_BRIGHTNESS,
  contrast: DEFAULT_TONE_CONTRAST,
  corners: [],
  cropRect: EMPTY_CROP_RECT,
  erasePaths: [],
  tonePreset: DEFAULT_TONE_PRESET,
};

function buildDraftFromDocument(document: DocumentResponse): EditorDraftState {
  return {
    activeErasePoints: [],
    activePerspectiveHandleIndex: null,
    brightness: document.brightness,
    contrast: document.contrast,
    corners: getEffectiveCorners(document),
    cropRect: document.crop_rect,
    erasePaths: document.erase_paths,
    tonePreset: document.tone_preset,
  };
}

function editorDraftReducer(
  state: EditorDraftState,
  action: EditorDraftAction,
): EditorDraftState {
  switch (action.type) {
    case "clear":
      return EMPTY_DRAFT_STATE;
    case "hydrate-all":
      return buildDraftFromDocument(action.document);
    case "hydrate-perspective-crop-erase":
      return {
        ...state,
        activeErasePoints: [],
        activePerspectiveHandleIndex: null,
        corners: getEffectiveCorners(action.document),
        cropRect: action.document.crop_rect,
        erasePaths: action.document.erase_paths,
      };
    case "hydrate-crop-erase":
      return {
        ...state,
        activeErasePoints: [],
        cropRect: action.document.crop_rect,
        erasePaths: action.document.erase_paths,
      };
    case "hydrate-tone":
      return {
        ...state,
        brightness: action.document.brightness,
        contrast: action.document.contrast,
        tonePreset: action.document.tone_preset,
      };
    case "hydrate-erase":
      return {
        ...state,
        activeErasePoints: [],
        erasePaths: action.document.erase_paths,
      };
    case "update-corner":
      return {
        ...state,
        corners: state.corners.map((currentPoint, currentIndex) =>
          currentIndex === action.index ? action.point : currentPoint,
        ),
      };
    case "set-crop-rect":
      return {
        ...state,
        cropRect: action.cropRect,
      };
    case "set-tone-preset":
      return {
        ...state,
        tonePreset: action.tonePreset,
      };
    case "set-brightness":
      return {
        ...state,
        brightness: action.brightness,
      };
    case "set-contrast":
      return {
        ...state,
        contrast: action.contrast,
      };
    case "set-active-perspective-handle":
      return {
        ...state,
        activePerspectiveHandleIndex: action.index,
      };
    case "reset-perspective-local":
      return {
        ...state,
        corners: action.corners,
      };
    case "reset-crop-local":
      return {
        ...state,
        cropRect: action.cropRect,
      };
    case "reset-tone-local":
      return {
        ...state,
        brightness: DEFAULT_TONE_BRIGHTNESS,
        contrast: DEFAULT_TONE_CONTRAST,
        tonePreset: DEFAULT_TONE_PRESET,
      };
    case "add-erase-point":
      return {
        ...state,
        activeErasePoints: [...state.activeErasePoints, action.point],
      };
    case "complete-erase-region":
      if (state.activeErasePoints.length < 3) {
        return state;
      }

      return {
        ...state,
        activeErasePoints: [],
        erasePaths: [
          ...state.erasePaths,
          {
            points: state.activeErasePoints,
            mode: "fill_white",
          },
        ],
      };
    case "cancel-erase-region":
      return {
        ...state,
        activeErasePoints: [],
      };
    case "undo-last-erase":
      return {
        ...state,
        erasePaths: state.erasePaths.slice(0, -1),
      };
    case "clear-erase":
      return {
        ...state,
        activeErasePoints: [],
        erasePaths: [],
      };
  }
}

export function SelectedPageEditor({
  document,
  isSessionLoading,
  activeDocumentAction,
  onSavePerspective,
  onResetPerspective,
  onRerunAutoDetect,
  onSaveCrop,
  onResetCrop,
  onSaveTone,
  onResetTone,
  onSaveErase,
}: SelectedPageEditorProps) {
  const [editorMode, setEditorMode] = useState<EditorMode>("perspective");
  const [draft, dispatchDraft] = useReducer(editorDraftReducer, EMPTY_DRAFT_STATE);
  const previousDocumentIdRef = useRef<string | null>(null);
  const previousPreviewVersionRef = useRef<string | null>(null);

  const effectiveCorners = useMemo(() => {
    return document === null ? [] : getEffectiveCorners(document);
  }, [document]);
  const fullCropRect = useMemo(() => {
    return effectiveCorners.length === 4 ? buildFullCropRect(effectiveCorners) : null;
  }, [effectiveCorners]);

  useEffect(() => {
    if (document === null) {
      dispatchDraft({ type: "clear" });
      previousDocumentIdRef.current = null;
      previousPreviewVersionRef.current = null;
      return;
    }

    const previousDocumentId = previousDocumentIdRef.current;
    const previousPreviewVersion = previousPreviewVersionRef.current;
    const isNewSelection = previousDocumentId !== document.id;
    const hasNewServerState = previousPreviewVersion !== document.preview_version;
    const isActiveDocumentAction =
      activeDocumentAction !== null && activeDocumentAction.documentId === document.id;

    if (isNewSelection) {
      dispatchDraft({ type: "hydrate-all", document });
    } else if (hasNewServerState && isActiveDocumentAction) {
      switch (activeDocumentAction.action) {
        case "save-perspective":
        case "reset-perspective":
        case "auto-detect":
          dispatchDraft({ type: "hydrate-perspective-crop-erase", document });
          break;
        case "save-crop":
        case "reset-crop":
          dispatchDraft({ type: "hydrate-crop-erase", document });
          break;
        case "save-tone":
        case "reset-tone":
          dispatchDraft({ type: "hydrate-tone", document });
          break;
        case "save-erase":
          dispatchDraft({ type: "hydrate-erase", document });
          break;
      }
    }

    previousDocumentIdRef.current = document.id;
    previousPreviewVersionRef.current = document.preview_version;
  }, [activeDocumentAction, document]);

  const hasUnsavedPerspectiveChanges =
    document !== null &&
    draft.corners.length === 4 &&
    !arePointsEqual(draft.corners, effectiveCorners);
  const isPerspectiveDraftValid =
    draft.corners.length === 4 && isQuadrilateralValid(draft.corners);
  const hasUnsavedCropChanges =
    document !== null && !areCropRectsEqual(draft.cropRect, document.crop_rect);
  const hasUnsavedToneChanges =
    document !== null &&
    (draft.tonePreset !== document.tone_preset ||
      draft.brightness !== document.brightness ||
      draft.contrast !== document.contrast);
  const hasUnsavedEraseChanges =
    document !== null && !areErasePathsEqual(draft.erasePaths, document.erase_paths);
  const isActionPending =
    document !== null &&
    activeDocumentAction !== null &&
    activeDocumentAction.documentId === document.id;
  const isToneAtDefault =
    document !== null &&
    document.tone_preset === DEFAULT_TONE_PRESET &&
    document.brightness === DEFAULT_TONE_BRIGHTNESS &&
    document.contrast === DEFAULT_TONE_CONTRAST;
  const isCropAtFullBounds =
    document !== null &&
    fullCropRect !== null &&
    areCropRectsEqual(document.crop_rect, fullCropRect);
  const hasActiveEraseRegion = draft.activeErasePoints.length > 0;
  const canCompleteEraseRegion = draft.activeErasePoints.length >= 3;

  function updateCorner(index: number, point: Point) {
    dispatchDraft({ type: "update-corner", index, point });
  }

  function handleAddErasePoint(point: Point) {
    dispatchDraft({ type: "add-erase-point", point });
  }

  function handleCompleteEraseRegion() {
    if (!canCompleteEraseRegion) {
      return;
    }

    dispatchDraft({ type: "complete-erase-region" });
  }

  function handleCancelEraseRegion() {
    dispatchDraft({ type: "cancel-erase-region" });
  }

  function handleUndoLastErase() {
    dispatchDraft({ type: "undo-last-erase" });
  }

  function handleClearAllErase() {
    dispatchDraft({ type: "clear-erase" });
  }

  function handleResetErase() {
    if (document === null) {
      return;
    }

    dispatchDraft({ type: "hydrate-erase", document });
  }

  async function handleSavePerspective() {
    if (document === null || draft.corners.length !== 4 || !isPerspectiveDraftValid) {
      return;
    }

    await onSavePerspective(document.id, draft.corners, buildFullCropRect(draft.corners));
  }

  async function handleResetPerspective() {
    if (document === null) {
      return;
    }

    dispatchDraft({ type: "reset-perspective-local", corners: document.auto_corners });

    if (document.user_corners !== null) {
      const resetCropRect = buildFullCropRect(document.auto_corners);
      dispatchDraft({ type: "reset-crop-local", cropRect: resetCropRect });
      await onResetPerspective(document.id, resetCropRect);
    }
  }

  async function handleRerunAutoDetect() {
    if (document === null) {
      return;
    }

    await onRerunAutoDetect(document.id);
  }

  async function handleSaveCrop() {
    if (document === null || fullCropRect === null) {
      return;
    }

    await onSaveCrop(
      document.id,
      document.user_corners,
      normalizeCropRect(draft.cropRect, fullCropRect.width, fullCropRect.height),
    );
  }

  async function handleResetCrop() {
    if (document === null || fullCropRect === null) {
      return;
    }

    dispatchDraft({ type: "reset-crop-local", cropRect: fullCropRect });

    if (!isCropAtFullBounds) {
      await onResetCrop(document.id, document.user_corners, fullCropRect);
    }
  }

  async function handleSaveTone() {
    if (document === null) {
      return;
    }

    await onSaveTone(document.id, draft.tonePreset, draft.brightness, draft.contrast);
  }

  async function handleResetTone() {
    if (document === null) {
      return;
    }

    dispatchDraft({ type: "reset-tone-local" });

    if (!isToneAtDefault) {
      await onResetTone(document.id);
    }
  }

  async function handleSaveErase() {
    if (document === null || hasActiveEraseRegion) {
      return;
    }

    await onSaveErase(document.id, draft.erasePaths);
  }

  function renderEditorSurface() {
    if (document === null) {
      return null;
    }

    if (editorMode === "crop") {
      if (fullCropRect === null) {
        return null;
      }

      return (
        <>
          <div className="editor-section-heading">
            <div>
              <p className="panel-kicker">Crop editor</p>
              <h3>{document.filename}</h3>
            </div>
            <span className="editor-mode-badge">
              {Math.round(draft.cropRect.width)} × {Math.round(draft.cropRect.height)}
            </span>
          </div>

          <p className="editor-instructions">
            Resize with the corner handles or drag inside the frame to move the crop on
            the transformed preview.
          </p>

          <CropEditorCanvas
            cropRect={draft.cropRect}
            disabled={isActionPending}
            imageHeight={fullCropRect.height}
            imageUrl={document.transformed_preview_url}
            imageWidth={fullCropRect.width}
            onCropRectChange={(cropRect) => {
              dispatchDraft({ type: "set-crop-rect", cropRect });
            }}
          />

          <div className="editor-actions">
            <button
              className="primary-action"
              type="button"
              disabled={isActionPending || !hasUnsavedCropChanges}
              onClick={() => {
                void handleSaveCrop();
              }}
            >
              {activeDocumentAction?.action === "save-crop" && isActionPending
                ? "Saving..."
                : "Save Crop"}
            </button>
            <button
              className="secondary-action"
              type="button"
              disabled={isActionPending || (isCropAtFullBounds && !hasUnsavedCropChanges)}
              onClick={() => {
                void handleResetCrop();
              }}
            >
              {activeDocumentAction?.action === "reset-crop" && isActionPending
                ? "Resetting..."
                : "Reset Crop"}
            </button>
          </div>
        </>
      );
    }

    if (editorMode === "tone") {
      return (
        <>
          <div className="editor-section-heading">
            <div>
              <p className="panel-kicker">Tone controls</p>
              <h3>{document.filename}</h3>
            </div>
            <span className="editor-mode-badge">
              {formatTonePresetLabel(draft.tonePreset)}
            </span>
          </div>

          <p className="editor-instructions">
            Use named cleanup presets, then fine-tune brightness and contrast before
            saving the page-specific tone settings.
          </p>

          <ToneControls
            brightness={draft.brightness}
            contrast={draft.contrast}
            disabled={isActionPending}
            hasUnsavedChanges={hasUnsavedToneChanges}
            preset={draft.tonePreset}
            resetDisabled={isActionPending || (isToneAtDefault && !hasUnsavedToneChanges)}
            resetLabel={
              activeDocumentAction?.action === "reset-tone" && isActionPending
                ? "Resetting..."
                : "Reset Tone"
            }
            saveDisabled={isActionPending || !hasUnsavedToneChanges}
            saveLabel={
              activeDocumentAction?.action === "save-tone" && isActionPending
                ? "Saving..."
                : "Save Tone"
            }
            onBrightnessChange={(brightness) => {
              dispatchDraft({ type: "set-brightness", brightness });
            }}
            onContrastChange={(contrast) => {
              dispatchDraft({ type: "set-contrast", contrast });
            }}
            onPresetChange={(tonePreset) => {
              dispatchDraft({ type: "set-tone-preset", tonePreset });
            }}
            onReset={() => {
              void handleResetTone();
            }}
            onSave={() => {
              void handleSaveTone();
            }}
          />
        </>
      );
    }

    if (editorMode === "erase") {
      return (
        <>
          <div className="editor-section-heading">
            <div>
              <p className="panel-kicker">Erase editor</p>
              <h3>{document.filename}</h3>
            </div>
            <span className="editor-mode-badge">
              {formatEraseCount(draft.erasePaths.length)}
            </span>
          </div>

          <p className="editor-instructions">
            Click the corrected preview to place polygon points. Complete each region
            when it encloses the content you want filled white, then save to update the
            backend preview.
          </p>

          <EraseEditorCanvas
            activePath={draft.activeErasePoints}
            disabled={isActionPending}
            erasePaths={draft.erasePaths}
            imageHeight={document.crop_rect.height}
            imageUrl={document.preview_url}
            imageWidth={document.crop_rect.width}
            onAddPoint={handleAddErasePoint}
          />

          <p className="erase-editor-status">
            {hasActiveEraseRegion
              ? `Region in progress: ${draft.activeErasePoints.length} point${draft.activeErasePoints.length === 1 ? "" : "s"}.`
              : hasUnsavedEraseChanges
                ? "Erase overlays are local until you save them."
                : "Erase regions match the saved backend state."}
          </p>

          <div className="editor-actions">
            <button
              className="secondary-action"
              type="button"
              disabled={isActionPending || !canCompleteEraseRegion}
              onClick={handleCompleteEraseRegion}
            >
              Complete Region
            </button>
            <button
              className="secondary-action"
              type="button"
              disabled={isActionPending || !hasActiveEraseRegion}
              onClick={handleCancelEraseRegion}
            >
              Cancel Region
            </button>
            <button
              className="secondary-action"
              type="button"
              disabled={isActionPending || draft.erasePaths.length === 0}
              onClick={handleUndoLastErase}
            >
              Undo Last Erase
            </button>
            <button
              className="secondary-action"
              type="button"
              disabled={isActionPending || (draft.erasePaths.length === 0 && !hasActiveEraseRegion)}
              onClick={handleClearAllErase}
            >
              Clear All
            </button>
            <button
              className="primary-action"
              type="button"
              disabled={isActionPending || hasActiveEraseRegion || !hasUnsavedEraseChanges}
              onClick={() => {
                void handleSaveErase();
              }}
            >
              {activeDocumentAction?.action === "save-erase" && isActionPending
                ? "Saving..."
                : "Save Erase"}
            </button>
            <button
              className="secondary-action"
              type="button"
              disabled={isActionPending || (!hasUnsavedEraseChanges && !hasActiveEraseRegion)}
              onClick={handleResetErase}
            >
              Reset Erase
            </button>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="editor-section-heading">
          <div>
            <p className="panel-kicker">Source image</p>
            <h3>{document.filename}</h3>
          </div>
          <span className={`status-chip status-chip--${document.auto_detect_status}`}>
            {formatDetectStatus(document.auto_detect_status)}
          </span>
        </div>

        <p className="editor-instructions">
          Drag the four handles to match the page corners on the original image, then
          save to refresh the corrected preview.
        </p>

        <PerspectiveEditorCanvas
          activeHandleIndex={draft.activePerspectiveHandleIndex}
          corners={draft.corners}
          disabled={isActionPending}
          imageHeight={document.normalized_height}
          imageUrl={document.source_url}
          imageWidth={document.normalized_width}
          onActiveHandleChange={(index) => {
            dispatchDraft({ type: "set-active-perspective-handle", index });
          }}
          onCornerChange={updateCorner}
        />

        {!isPerspectiveDraftValid ? (
          <p className="editor-validation" role="alert">
            Corner lines cannot cross. Keep the four points in page order.
          </p>
        ) : null}

        <div className="editor-actions">
          <button
            className="primary-action"
            type="button"
            disabled={isActionPending || !hasUnsavedPerspectiveChanges || !isPerspectiveDraftValid}
            onClick={() => {
              void handleSavePerspective();
            }}
          >
            {activeDocumentAction?.action === "save-perspective" && isActionPending
              ? "Saving..."
              : "Save Perspective"}
          </button>
          <button
            className="secondary-action"
            type="button"
            disabled={isActionPending}
            onClick={() => {
              void handleResetPerspective();
            }}
          >
            {activeDocumentAction?.action === "reset-perspective" && isActionPending
              ? "Resetting..."
              : "Reset To Auto"}
          </button>
          <button
            className="secondary-action"
            type="button"
            disabled={isActionPending}
            onClick={() => {
              void handleRerunAutoDetect();
            }}
          >
            {activeDocumentAction?.action === "auto-detect" && isActionPending
              ? "Detecting..."
              : "Re-run Auto-detect"}
          </button>
        </div>
      </>
    );
  }

  return (
    <section className="editor-panel" aria-label="Selected page editor">
      <div className="panel-heading panel-heading--editor">
        <div>
          <p className="panel-kicker">Editor</p>
          <h2>Page cleanup</h2>
          <p className="editor-mode-summary">
            Perspective, crop, tone, and erase settings stay independent for each
            uploaded page.
          </p>
        </div>

        <div className="tool-mode-switcher" role="tablist" aria-label="Editor mode">
          <button
            className={`tool-mode-button${editorMode === "perspective" ? " is-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={editorMode === "perspective"}
            onClick={() => {
              setEditorMode("perspective");
            }}
          >
            Perspective
          </button>
          <button
            className={`tool-mode-button${editorMode === "crop" ? " is-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={editorMode === "crop"}
            onClick={() => {
              setEditorMode("crop");
            }}
          >
            Crop
          </button>
          <button
            className={`tool-mode-button${editorMode === "tone" ? " is-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={editorMode === "tone"}
            onClick={() => {
              setEditorMode("tone");
            }}
          >
            Tone
          </button>
          <button
            className={`tool-mode-button${editorMode === "erase" ? " is-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={editorMode === "erase"}
            onClick={() => {
              setEditorMode("erase");
            }}
          >
            Erase
          </button>
        </div>
      </div>

      {isSessionLoading ? (
        <EmptyPanel
          large
          title="Workspace loading"
          message="The selected page view will appear once the session is ready."
        />
      ) : document === null ? (
        <EmptyPanel
          large
          title="No page selected"
          message="Upload pages first, then refine perspective, crop, tone, and erase here."
        />
      ) : (
        <article className="editor-card editor-card--phase5">
          <div className="editor-workspace">
            <div className="editor-surface">{renderEditorSurface()}</div>

            <div className="preview-frame preview-frame--result">
              <PreviewPane filename={document.filename} previewUrl={document.preview_url} />
            </div>
          </div>

          <div className="document-summary">
            <div className="document-copy">
              <p className="panel-kicker">Current document</p>
              <h3>{document.filename}</h3>
              <p>
                Manual corrections remain page-specific. Save each mode when you want
                the backend preview to refresh.
              </p>
              {document.auto_detect_status === "fallback_full_image" ? (
                <p className="summary-warning">
                  Auto-detect fell back to the full image bounds. Manual perspective
                  correction is expected for this page.
                </p>
              ) : null}
            </div>

            <dl className="document-metadata document-metadata--phase5">
              <div>
                <dt>Order</dt>
                <dd>{document.order_index + 1}</dd>
              </div>
              <div>
                <dt>Source size</dt>
                <dd>{document.normalized_width} × {document.normalized_height}</dd>
              </div>
              <div>
                <dt>Detection</dt>
                <dd>{formatDetectStatus(document.auto_detect_status)}</dd>
              </div>
              <div>
                <dt>Perspective mode</dt>
                <dd>{document.user_corners === null ? "Auto" : "Manual"}</dd>
              </div>
              <div>
                <dt>Crop area</dt>
                <dd>
                  {Math.round(document.crop_rect.width)} × {Math.round(document.crop_rect.height)}
                </dd>
              </div>
              <div>
                <dt>Crop offset</dt>
                <dd>
                  {Math.round(document.crop_rect.x)}, {Math.round(document.crop_rect.y)}
                </dd>
              </div>
              <div>
                <dt>Tone preset</dt>
                <dd>{formatTonePresetLabel(document.tone_preset)}</dd>
              </div>
              <div>
                <dt>Adjustments</dt>
                <dd>
                  B {formatAdjustment(document.brightness)} / C{" "}
                  {formatAdjustment(document.contrast)}
                </dd>
              </div>
              <div>
                <dt>Erase regions</dt>
                <dd>{document.erase_paths.length}</dd>
              </div>
            </dl>
          </div>
        </article>
      )}
    </section>
  );
}

interface PreviewPaneProps {
  filename: string;
  previewUrl: string;
}

function PreviewPane({ filename, previewUrl }: PreviewPaneProps) {
  const [failedPreviewUrl, setFailedPreviewUrl] = useState<string | null>(null);
  const hasPreviewError = failedPreviewUrl === previewUrl;

  return hasPreviewError ? (
    <div className="preview-error" role="alert">
      <h3>Preview unavailable</h3>
      <p>
        The transformed preview could not be loaded for this page. The editing controls
        are still available for local adjustments.
      </p>
    </div>
  ) : (
    <>
      <div className="editor-section-heading">
        <div>
          <p className="panel-kicker">Corrected preview</p>
          <h3>Latest render</h3>
        </div>
      </div>
      <img
        className="preview-image"
        src={previewUrl}
        alt={`Transformed preview of ${filename}`}
        onError={() => setFailedPreviewUrl(previewUrl)}
      />
    </>
  );
}
