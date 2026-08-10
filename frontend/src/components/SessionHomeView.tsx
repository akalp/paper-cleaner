import type { SessionSummary } from "../types";
import { formatPageCount, formatUpdatedAt } from "../utils/sessionFormat";
import { EmptyPanel } from "./EmptyPanel";
import { SessionHistoryPanel } from "./SessionHistoryPanel";

interface SessionHomeViewProps {
  sessions: SessionSummary[];
  resumeSession: SessionSummary | null;
  activeSessionId: string | null;
  isSessionLoading: boolean;
  isCreatingSession: boolean;
  deletingSessionId: string | null;
  onCreateSession: () => Promise<void>;
  onOpenSession: (sessionId: string) => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
}

export function SessionHomeView({
  sessions,
  resumeSession,
  activeSessionId,
  isSessionLoading,
  isCreatingSession,
  deletingSessionId,
  onCreateSession,
  onOpenSession,
  onDeleteSession,
}: SessionHomeViewProps) {
  const isBusy = isSessionLoading || isCreatingSession || deletingSessionId !== null;

  return (
    <section className="session-home">
      <div className="session-home-hero">
        <p className="workspace-kicker">Workspace</p>
        <h1>paper-cleaner</h1>
        <p className="workspace-description">
          Upload pages, correct perspective, refine crop on the transformed preview, erase unwanted
          regions, reorder pages, and export print-ready results.
        </p>
        <button
          className="primary-action session-home-create"
          type="button"
          disabled={isBusy}
          onClick={() => {
            void onCreateSession();
          }}
        >
          {isCreatingSession ? "Creating..." : "New Session"}
        </button>
      </div>

      {resumeSession !== null ? (
        <article className="resume-card">
          <div className="resume-card-copy">
            <p className="panel-kicker">Resume</p>
            <h2>{resumeSession.first_document_filename ?? "Empty session"}</h2>
            <p className="resume-card-meta">
              {formatPageCount(resumeSession.document_count)} /{" "}
              {formatUpdatedAt(resumeSession.updated_at)}
            </p>
          </div>
          <button
            className="primary-action"
            type="button"
            disabled={isSessionLoading}
            onClick={() => {
              void onOpenSession(resumeSession.id);
            }}
          >
            Resume
          </button>
        </article>
      ) : null}

      {isSessionLoading ? (
        <EmptyPanel
          large
          title="Preparing workspace"
          message="Loading local sessions and the last active workspace."
        />
      ) : (
        <SessionHistoryPanel
          sessions={sessions}
          activeSessionId={activeSessionId}
          isSessionLoading={isSessionLoading}
          isCreatingSession={isCreatingSession}
          deletingSessionId={deletingSessionId}
          onCreateSession={onCreateSession}
          onOpenSession={onOpenSession}
          onDeleteSession={onDeleteSession}
          hideCreateButton
        />
      )}
    </section>
  );
}
