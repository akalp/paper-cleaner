import type { ExportAction } from "../types";

interface WorkspaceHeaderProps {
  isSessionLoading: boolean;
  isUploading: boolean;
  hasDocuments: boolean;
  selectedDocumentName: string | null;
  activeExportAction: ExportAction | null;
  onUploadClick: () => void;
  onNavigateHome: () => void;
  onExportCurrentDocument: () => Promise<void>;
  onExportZip: () => Promise<void>;
  onExportPdf: () => Promise<void>;
}

export function WorkspaceHeader({
  isSessionLoading,
  isUploading,
  hasDocuments,
  selectedDocumentName,
  activeExportAction,
  onUploadClick,
  onNavigateHome,
  onExportCurrentDocument,
  onExportZip,
  onExportPdf,
}: WorkspaceHeaderProps) {
  const canExportSession = !isSessionLoading && hasDocuments;
  const canExportCurrentPage = canExportSession && selectedDocumentName !== null;
  const isExporting = activeExportAction !== null;

  return (
    <header className="workspace-header">
      <div className="workspace-heading">
        <p className="workspace-kicker">Workspace</p>
        <h1>paper-cleaner</h1>
        <p className="session-label">
          {selectedDocumentName !== null ? `Editing ${selectedDocumentName}` : "Active session"}
        </p>
      </div>

      <div className="workspace-actions">
        <button
          className="secondary-action"
          type="button"
          onClick={onNavigateHome}
          disabled={isSessionLoading}
        >
          Sessions
        </button>
        <button
          className="primary-action"
          type="button"
          onClick={onUploadClick}
          disabled={isSessionLoading || isUploading}
        >
          {isUploading ? "Uploading..." : "Upload Images"}
        </button>
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
