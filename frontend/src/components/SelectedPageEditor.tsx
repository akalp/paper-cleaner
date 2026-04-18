import { useState } from "react";

import type { CropRect, DocumentResponse, Point } from "../types";
import { arePointsEqual, buildFullCropRect, isQuadrilateralValid } from "../utils/perspectiveGeometry";
import { EmptyPanel } from "./EmptyPanel";
import { PerspectiveEditorCanvas } from "./PerspectiveEditorCanvas";

interface ActiveDocumentAction {
  action: "save" | "reset" | "auto-detect";
  documentId: string;
}

interface SelectedPageEditorProps {
  document: DocumentResponse | null;
  isSessionLoading: boolean;
  activeDocumentAction: ActiveDocumentAction | null;
  onSavePerspective: (documentId: string, userCorners: Point[], cropRect: CropRect) => Promise<void>;
  onResetPerspective: (documentId: string, cropRect: CropRect) => Promise<void>;
  onRerunAutoDetect: (documentId: string) => Promise<void>;
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

export function SelectedPageEditor({
  document,
  isSessionLoading,
  activeDocumentAction,
  onSavePerspective,
  onResetPerspective,
  onRerunAutoDetect,
}: SelectedPageEditorProps) {
  const [draftCorners, setDraftCorners] = useState<Point[]>(
    document === null ? [] : getEffectiveCorners(document),
  );
  const [activeHandleIndex, setActiveHandleIndex] = useState<number | null>(null);
  const effectiveCorners = document === null ? [] : getEffectiveCorners(document);

  const hasUnsavedChanges =
    document !== null &&
    draftCorners.length === 4 &&
    !arePointsEqual(draftCorners, effectiveCorners);
  const isDraftValid = draftCorners.length === 4 && isQuadrilateralValid(draftCorners);
  const isActionPending =
    document !== null &&
    activeDocumentAction !== null &&
    activeDocumentAction.documentId === document.id;

  function updateCorner(index: number, point: Point) {
    setDraftCorners((currentCorners) =>
      currentCorners.map((currentPoint, currentIndex) =>
        currentIndex === index ? point : currentPoint,
      ),
    );
  }

  async function handleSave() {
    if (document === null || draftCorners.length !== 4 || !isDraftValid) {
      return;
    }

    await onSavePerspective(document.id, draftCorners, buildFullCropRect(draftCorners));
  }

  async function handleReset() {
    if (document === null) {
      return;
    }

    setDraftCorners(document.auto_corners);

    if (document.user_corners !== null) {
      await onResetPerspective(
        document.id,
        buildFullCropRect(document.auto_corners),
      );
    }
  }

  async function handleRerunAutoDetect() {
    if (document === null) {
      return;
    }

    await onRerunAutoDetect(document.id);
  }

  return (
    <section className="editor-panel" aria-label="Selected page editor">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Editor</p>
          <h2>Perspective cleanup</h2>
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
          message="Upload pages first, then adjust the detected document boundary here."
        />
      ) : (
        <article className="editor-card editor-card--phase4">
          <div className="editor-workspace">
            <div className="editor-surface">
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
                Drag the four handles to match the page corners on the original image,
                then save to refresh the corrected preview.
              </p>

              <PerspectiveEditorCanvas
                activeHandleIndex={activeHandleIndex}
                corners={draftCorners}
                disabled={isActionPending}
                imageHeight={document.normalized_height}
                imageUrl={document.source_url}
                imageWidth={document.normalized_width}
                onActiveHandleChange={setActiveHandleIndex}
                onCornerChange={updateCorner}
              />

              {!isDraftValid ? (
                <p className="editor-validation" role="alert">
                  Corner lines cannot cross. Keep the four points in page order.
                </p>
              ) : null}

              <div className="editor-actions">
                <button
                  className="primary-action"
                  type="button"
                  disabled={isActionPending || !hasUnsavedChanges || !isDraftValid}
                  onClick={() => {
                    void handleSave();
                  }}
                >
                  {activeDocumentAction?.action === "save" && isActionPending
                    ? "Saving..."
                    : "Save Perspective"}
                </button>
                <button
                  className="secondary-action"
                  type="button"
                  disabled={isActionPending}
                  onClick={() => {
                    void handleReset();
                  }}
                >
                  {activeDocumentAction?.action === "reset" && isActionPending
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
            </div>

            <div className="preview-frame preview-frame--result">
              <PreviewPane
                key={document.preview_url}
                filename={document.filename}
                previewUrl={document.preview_url}
              />
            </div>
          </div>

          <div className="document-summary">
            <div className="document-copy">
              <p className="panel-kicker">Current document</p>
              <h3>{document.filename}</h3>
              <p>
                Auto-detection is only a starting point. Save manual corner changes to
                keep this page independent from the rest of the session.
              </p>
              {document.auto_detect_status === "fallback_full_image" ? (
                <p className="summary-warning">
                  Auto-detect fell back to the full image bounds. Manual correction is
                  expected for this page.
                </p>
              ) : null}
            </div>

            <dl className="document-metadata">
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

  return hasPreviewError ? (
    <div className="preview-error" role="alert">
      <h3>Preview unavailable</h3>
      <p>
        The transformed preview could not be loaded for this page. The source editor
        is still available for manual adjustment.
      </p>
    </div>
  ) : (
    <>
      <div className="editor-section-heading">
        <div>
          <p className="panel-kicker">Corrected preview</p>
          <h3>Transformed result</h3>
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
