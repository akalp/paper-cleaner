import type { ExportAction } from "../types";

interface WorkspaceHeaderProps {
  isSessionLoading: boolean;
  isUploading: boolean;
  sessionId: string | null;
  hasDocuments: boolean;
  selectedDocumentName: string | null;
  activeExportAction: ExportAction | null;
  onUploadClick: () => void;
  onExportCurrentDocument: () => Promise<void>;
  onExportZip: () => Promise<void>;
  onExportPdf: () => Promise<void>;
}

export function WorkspaceHeader({
  isSessionLoading,
  isUploading,
  sessionId,
  hasDocuments,
  selectedDocumentName,
  activeExportAction,
  onUploadClick,
  onExportCurrentDocument,
  onExportZip,
  onExportPdf,
}: WorkspaceHeaderProps) {
  const canExportSession = !isSessionLoading && sessionId !== null && hasDocuments;
  const canExportCurrentPage = canExportSession && selectedDocumentName !== null;
  const isExporting = activeExportAction !== null;

  return (
    <header className="workspace-header">
      <div>
        <p className="workspace-kicker">Workspace</p>
        <h1>paper-cleaner</h1>
        <p className="workspace-description">
          Upload pages, correct perspective, refine crop on the transformed preview, erase unwanted
          regions, reorder pages, and export print-ready results.
        </p>
      </div>

      <div className="workspace-actions">
        <button
          className="primary-action"
          type="button"
          onClick={onUploadClick}
          disabled={isSessionLoading || sessionId === null || isUploading}
        >
          {isUploading ? "Uploading..." : "Upload Images"}
        </button>
        <p className="session-label">
          {sessionId === null ? "No active session" : `Session ${sessionId}`}
        </p>
        <div className="export-actions" aria-label="Export actions">
          <button
            className="secondary-action"
            type="button"
            onClick={() => {
              void onExportCurrentDocument();
            }}
            disabled={!canExportCurrentPage || isExporting}
          >
            {activeExportAction === "page-image" ? "Exporting Page..." : "Export Page PNG"}
          </button>
          <button
            className="secondary-action"
            type="button"
            onClick={() => {
              void onExportZip();
            }}
            disabled={!canExportSession || isExporting}
          >
            {activeExportAction === "zip" ? "Exporting ZIP..." : "Export ZIP"}
          </button>
          <button
            className="secondary-action"
            type="button"
            onClick={() => {
              void onExportPdf();
            }}
            disabled={!canExportSession || isExporting}
          >
            {activeExportAction === "pdf" ? "Exporting PDF..." : "Export PDF"}
          </button>
        </div>
      </div>
    </header>
  );
}
