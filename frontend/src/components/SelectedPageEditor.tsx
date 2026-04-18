import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import type {
  ActiveDocumentAction,
  CropRect,
  DocumentResponse,
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
import { PerspectiveEditorCanvas } from "./PerspectiveEditorCanvas";
import { ToneControls } from "./ToneControls";

type EditorMode = "perspective" | "crop" | "tone";

const DEFAULT_TONE_PRESET: TonePreset = "printer_friendly";
const DEFAULT_TONE_BRIGHTNESS = 0;
const DEFAULT_TONE_CONTRAST = 0;

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

function hydratePerspectiveDraft(
  document: DocumentResponse,
  setDraftCorners: Dispatch<SetStateAction<Point[]>>,
  setActivePerspectiveHandleIndex: Dispatch<SetStateAction<number | null>>,
) {
  setDraftCorners(getEffectiveCorners(document));
  setActivePerspectiveHandleIndex(null);
}

function hydrateCropDraft(
  document: DocumentResponse,
  setDraftCropRect: Dispatch<SetStateAction<CropRect>>,
) {
  setDraftCropRect(document.crop_rect);
}

function hydrateToneDraft(
  document: DocumentResponse,
  setDraftTonePreset: Dispatch<SetStateAction<TonePreset>>,
  setDraftBrightness: Dispatch<SetStateAction<number>>,
  setDraftContrast: Dispatch<SetStateAction<number>>,
) {
  setDraftTonePreset(document.tone_preset);
  setDraftBrightness(document.brightness);
  setDraftContrast(document.contrast);
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
}: SelectedPageEditorProps) {
  const [editorMode, setEditorMode] = useState<EditorMode>("perspective");
  const [draftCorners, setDraftCorners] = useState<Point[]>([]);
  const [draftCropRect, setDraftCropRect] = useState<CropRect>({
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  });
  const [draftTonePreset, setDraftTonePreset] = useState<TonePreset>(DEFAULT_TONE_PRESET);
  const [draftBrightness, setDraftBrightness] = useState(DEFAULT_TONE_BRIGHTNESS);
  const [draftContrast, setDraftContrast] = useState(DEFAULT_TONE_CONTRAST);
  const [activePerspectiveHandleIndex, setActivePerspectiveHandleIndex] = useState<number | null>(
    null,
  );
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
      setDraftCorners([]);
      setDraftCropRect({ x: 0, y: 0, width: 1, height: 1 });
      setDraftTonePreset(DEFAULT_TONE_PRESET);
      setDraftBrightness(DEFAULT_TONE_BRIGHTNESS);
      setDraftContrast(DEFAULT_TONE_CONTRAST);
      setActivePerspectiveHandleIndex(null);
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
      hydratePerspectiveDraft(document, setDraftCorners, setActivePerspectiveHandleIndex);
      hydrateCropDraft(document, setDraftCropRect);
      hydrateToneDraft(
        document,
        setDraftTonePreset,
        setDraftBrightness,
        setDraftContrast,
      );
    } else if (hasNewServerState && isActiveDocumentAction) {
      switch (activeDocumentAction.action) {
        case "save-perspective":
        case "reset-perspective":
        case "auto-detect":
          hydratePerspectiveDraft(document, setDraftCorners, setActivePerspectiveHandleIndex);
          hydrateCropDraft(document, setDraftCropRect);
          break;
        case "save-crop":
        case "reset-crop":
          hydrateCropDraft(document, setDraftCropRect);
          break;
        case "save-tone":
        case "reset-tone":
          hydrateToneDraft(
            document,
            setDraftTonePreset,
            setDraftBrightness,
            setDraftContrast,
          );
          break;
      }
    }

    previousDocumentIdRef.current = document.id;
    previousPreviewVersionRef.current = document.preview_version;
  }, [activeDocumentAction, document]);

  const hasUnsavedPerspectiveChanges =
    document !== null &&
    draftCorners.length === 4 &&
    !arePointsEqual(draftCorners, effectiveCorners);
  const isPerspectiveDraftValid =
    draftCorners.length === 4 && isQuadrilateralValid(draftCorners);
  const hasUnsavedCropChanges =
    document !== null && !areCropRectsEqual(draftCropRect, document.crop_rect);
  const hasUnsavedToneChanges =
    document !== null &&
    (draftTonePreset !== document.tone_preset ||
      draftBrightness !== document.brightness ||
      draftContrast !== document.contrast);
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
    document !== null && fullCropRect !== null && areCropRectsEqual(document.crop_rect, fullCropRect);

  function updateCorner(index: number, point: Point) {
    setDraftCorners((currentCorners) =>
      currentCorners.map((currentPoint, currentIndex) =>
        currentIndex === index ? point : currentPoint,
      ),
    );
  }

  async function handleSavePerspective() {
    if (document === null || draftCorners.length !== 4 || !isPerspectiveDraftValid) {
      return;
    }

    await onSavePerspective(document.id, draftCorners, buildFullCropRect(draftCorners));
  }

  async function handleResetPerspective() {
    if (document === null) {
      return;
    }

    setDraftCorners(document.auto_corners);

    if (document.user_corners !== null) {
      const resetCropRect = buildFullCropRect(document.auto_corners);
      setDraftCropRect(resetCropRect);
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
      normalizeCropRect(draftCropRect, fullCropRect.width, fullCropRect.height),
    );
  }

  async function handleResetCrop() {
    if (document === null || fullCropRect === null) {
      return;
    }

    setDraftCropRect(fullCropRect);

    if (!isCropAtFullBounds) {
      await onResetCrop(document.id, document.user_corners, fullCropRect);
    }
  }

  async function handleSaveTone() {
    if (document === null) {
      return;
    }

    await onSaveTone(document.id, draftTonePreset, draftBrightness, draftContrast);
  }

  async function handleResetTone() {
    if (document === null) {
      return;
    }

    setDraftTonePreset(DEFAULT_TONE_PRESET);
    setDraftBrightness(DEFAULT_TONE_BRIGHTNESS);
    setDraftContrast(DEFAULT_TONE_CONTRAST);

    if (!isToneAtDefault) {
      await onResetTone(document.id);
    }
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
              {Math.round(draftCropRect.width)} × {Math.round(draftCropRect.height)}
            </span>
          </div>

          <p className="editor-instructions">
            Resize with the corner handles or drag inside the frame to move the crop on
            the transformed preview.
          </p>

          <CropEditorCanvas
            cropRect={draftCropRect}
            disabled={isActionPending}
            imageHeight={fullCropRect.height}
            imageUrl={document.transformed_preview_url}
            imageWidth={fullCropRect.width}
            onCropRectChange={setDraftCropRect}
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
              {formatTonePresetLabel(draftTonePreset)}
            </span>
          </div>

          <p className="editor-instructions">
            Use named cleanup presets, then fine-tune brightness and contrast before
            saving the page-specific tone settings.
          </p>

          <ToneControls
            brightness={draftBrightness}
            contrast={draftContrast}
            disabled={isActionPending}
            hasUnsavedChanges={hasUnsavedToneChanges}
            preset={draftTonePreset}
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
            onBrightnessChange={setDraftBrightness}
            onContrastChange={setDraftContrast}
            onPresetChange={setDraftTonePreset}
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
          activeHandleIndex={activePerspectiveHandleIndex}
          corners={draftCorners}
          disabled={isActionPending}
          imageHeight={document.normalized_height}
          imageUrl={document.source_url}
          imageWidth={document.normalized_width}
          onActiveHandleChange={setActivePerspectiveHandleIndex}
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
            Perspective, crop, and tone settings stay independent for each uploaded
            page.
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
          message="Upload pages first, then refine perspective, crop, and tone here."
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
  const [hasPreviewError, setHasPreviewError] = useState(false);

  useEffect(() => {
    setHasPreviewError(false);
  }, [previewUrl]);

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
        onError={() => setHasPreviewError(true)}
      />
    </>
  );
}
