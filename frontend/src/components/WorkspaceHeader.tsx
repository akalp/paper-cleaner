interface WorkspaceHeaderProps {
  isSessionLoading: boolean;
  isUploading: boolean;
  sessionId: string | null;
  onUploadClick: () => void;
}

export function WorkspaceHeader({
  isSessionLoading,
  isUploading,
  sessionId,
  onUploadClick,
}: WorkspaceHeaderProps) {
  return (
    <header className="workspace-header">
      <div>
        <p className="workspace-kicker">Phase 4 Workspace</p>
        <h1>paper-cleaner</h1>
        <p className="workspace-description">
          Upload pages, inspect auto-detected document corners, and correct perspective
          before later cleanup phases.
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
      </div>
    </header>
  );
}
