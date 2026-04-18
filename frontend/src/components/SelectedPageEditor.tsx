import { useState } from "react";

import type { DocumentResponse } from "../types";
import { EmptyPanel } from "./EmptyPanel";

interface SelectedPageEditorProps {
  document: DocumentResponse | null;
  isSessionLoading: boolean;
}

export function SelectedPageEditor({
  document,
  isSessionLoading,
}: SelectedPageEditorProps) {
  return (
    <section className="editor-panel" aria-label="Selected page editor">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Editor</p>
          <h2>Selected page</h2>
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
          message="Upload pages first. Perspective, crop, tone, and erase tools are intentionally deferred to later phases."
        />
      ) : (
        <article className="editor-card">
          <PreviewPane
            key={`${document.id}:${document.preview_url}`}
            filename={document.filename}
            previewUrl={document.preview_url}
          />

          <div className="document-summary">
            <div className="document-copy">
              <p className="panel-kicker">Current document</p>
              <h3>{document.filename}</h3>
              <p>
                This workspace currently supports upload and page browsing. Editing
                controls will be added in later phases.
              </p>
            </div>

            <dl className="document-metadata">
              <div>
                <dt>Order</dt>
                <dd>{document.order_index + 1}</dd>
              </div>
              <div>
                <dt>Tone preset</dt>
                <dd>{document.tone_preset}</dd>
              </div>
              <div>
                <dt>Brightness</dt>
                <dd>{document.brightness}</dd>
              </div>
              <div>
                <dt>Contrast</dt>
                <dd>{document.contrast}</dd>
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

  return (
    <div className="preview-frame">
      {hasPreviewError ? (
        <div className="preview-error" role="alert">
          <h3>Preview unavailable</h3>
          <p>
            The backend preview could not be loaded for this page. Upload and page
            selection still work, but preview rendering needs to succeed before
            editing can continue.
          </p>
        </div>
      ) : (
        <img
          className="preview-image"
          src={previewUrl}
          alt={`Preview of ${filename}`}
          onError={() => setHasPreviewError(true)}
        />
      )}
    </div>
  );
}
