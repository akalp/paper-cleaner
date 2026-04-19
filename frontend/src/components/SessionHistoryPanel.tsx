import type { SessionSummary } from "../types";

interface SessionHistoryPanelProps {
  sessions: SessionSummary[];
  activeSessionId: string | null;
  isSessionLoading: boolean;
  isCreatingSession: boolean;
  deletingSessionId: string | null;
  onCreateSession: () => Promise<void>;
  onOpenSession: (sessionId: string) => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatPageCount(count: number): string {
  if (count === 1) {
    return "1 page";
  }

  return `${count} pages`;
}

export function SessionHistoryPanel({
  sessions,
  activeSessionId,
  isSessionLoading,
  isCreatingSession,
  deletingSessionId,
  onCreateSession,
  onOpenSession,
  onDeleteSession,
}: SessionHistoryPanelProps) {
  const isBusy = isSessionLoading || isCreatingSession || deletingSessionId !== null;

  function handleDeleteSession(session: SessionSummary) {
    const label = session.first_document_filename ?? session.id;
    const confirmed = window.confirm(
      `Delete "${label}"? This removes the session, uploaded files, and rendered previews.`,
    );
    if (!confirmed) {
      return;
    }

    void onDeleteSession(session.id);
  }

  return (
    <aside className="session-panel" aria-label="Session history">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">History</p>
          <h2>Sessions</h2>
        </div>
        <button
          className="primary-action session-new-button"
          type="button"
          disabled={isBusy}
          onClick={() => {
            void onCreateSession();
          }}
        >
          {isCreatingSession ? "Creating..." : "New Session"}
        </button>
      </div>

      {sessions.length === 0 ? (
        <p className="session-history-empty">
          No saved sessions yet. Create a session to start uploading pages.
        </p>
      ) : (
        <ol className="session-history-list">
          {sessions.map((session) => {
            const isActive = session.id === activeSessionId;
            const isDeleting = deletingSessionId === session.id;
            return (
              <li key={session.id} className={`session-row${isActive ? " is-active" : ""}`}>
                <button
                  className="session-open-button"
                  type="button"
                  disabled={isBusy || isActive}
                  onClick={() => {
                    void onOpenSession(session.id);
                  }}
                >
                  <span className="session-row-title">
                    {session.first_document_filename ?? "Empty session"}
                  </span>
                  <span className="session-row-meta">
                    {formatPageCount(session.document_count)} /{" "}
                    {formatUpdatedAt(session.updated_at)}
                  </span>
                  <span className="session-row-id">{session.id}</span>
                </button>
                <button
                  className="session-delete-button"
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleDeleteSession(session)}
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}
