import { useMemo, useRef, useState } from "react";

import { FeedbackPanel } from "./components/FeedbackPanel";
import { PageSidebar } from "./components/PageSidebar";
import { SelectedPageEditor } from "./components/SelectedPageEditor";
import { SessionHomeView } from "./components/SessionHomeView";
import { WorkspaceHeader } from "./components/WorkspaceHeader";
import { useWorkspaceSession } from "./hooks/useWorkspaceSession";

type WorkspaceView = "home" | "workspace";

function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [view, setView] = useState<WorkspaceView>("home");
  const {
    session,
    sessionHistory,
    resumeSessionId,
    documents,
    selectedDocument,
    selectedDocumentId,
    isSessionLoading,
    isCreatingSession,
    deletingSessionId,
    isUploading,
    sessionError,
    uploadError,
    documentActionError,
    workspaceActionError,
    isReordering,
    activeExportAction,
    activeDocumentAction,
    successNotice,
    clearSessionError,
    clearUploadError,
    clearDocumentActionError,
    clearWorkspaceActionError,
    dismissSuccessNotice,
    createNewSession,
    openSession,
    removeSession,
    selectDocument,
    uploadFiles,
    reorderDocuments,
    savePerspective,
    resetPerspective,
    rerunAutoDetect,
    saveCrop,
    resetCrop,
    saveTone,
    resetTone,
    saveErase,
    exportCurrentDocument,
    exportZip,
    exportPdf,
  } = useWorkspaceSession();

  const showWorkspace = view === "workspace" && session !== null;

  const resumeSession = useMemo(() => {
    if (resumeSessionId === null) {
      return null;
    }
    return sessionHistory.find((entry) => entry.id === resumeSessionId) ?? null;
  }, [resumeSessionId, sessionHistory]);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    await uploadFiles(files);
  }

  function triggerFilePicker() {
    if (isSessionLoading || session === null || isUploading) {
      return;
    }

    fileInputRef.current?.click();
  }

  async function handleCreateSession() {
    await createNewSession();
    setView("workspace");
  }

  async function handleOpenSession(sessionId: string) {
    await openSession(sessionId);
    setView("workspace");
  }

  return (
    <main className="workspace">
      <input
        ref={fileInputRef}
        className="sr-only"
        type="file"
        accept="image/*"
        multiple
        onChange={(event) => {
          void handleUpload(event);
        }}
      />

      {successNotice ? (
        <FeedbackPanel title="Success" message={successNotice} onDismiss={dismissSuccessNotice} />
      ) : null}

      {sessionError ? (
        <FeedbackPanel
          title="Session unavailable"
          message={sessionError}
          actionLabel="Retry"
          onAction={() => window.location.reload()}
          onDismiss={clearSessionError}
        />
      ) : null}

      {uploadError ? (
        <FeedbackPanel title="Upload failed" message={uploadError} onDismiss={clearUploadError} />
      ) : null}

      {documentActionError ? (
        <FeedbackPanel
          title="Document update failed"
          message={documentActionError}
          onDismiss={clearDocumentActionError}
        />
      ) : null}

      {workspaceActionError ? (
        <FeedbackPanel
          title="Workspace action failed"
          message={workspaceActionError}
          onDismiss={clearWorkspaceActionError}
        />
      ) : null}

      {showWorkspace ? (
        <>
          <WorkspaceHeader
            isSessionLoading={isSessionLoading}
            isUploading={isUploading}
            hasDocuments={documents.length > 0}
            selectedDocumentName={selectedDocument?.filename ?? null}
            activeExportAction={activeExportAction}
            onUploadClick={triggerFilePicker}
            onNavigateHome={() => setView("home")}
            onExportCurrentDocument={exportCurrentDocument}
            onExportZip={exportZip}
            onExportPdf={exportPdf}
          />

          <section className="workspace-body">
            <PageSidebar
              documents={documents}
              selectedDocumentId={selectedDocumentId}
              hasActiveSession={session !== null}
              isSessionLoading={isSessionLoading}
              isReordering={isReordering}
              onSelectDocument={selectDocument}
              onReorderDocuments={reorderDocuments}
            />
            <SelectedPageEditor
              document={selectedDocument}
              isSessionLoading={isSessionLoading}
              activeDocumentAction={activeDocumentAction}
              onSavePerspective={savePerspective}
              onResetPerspective={resetPerspective}
              onRerunAutoDetect={rerunAutoDetect}
              onSaveCrop={saveCrop}
              onResetCrop={resetCrop}
              onSaveTone={saveTone}
              onResetTone={resetTone}
              onSaveErase={saveErase}
            />
          </section>
        </>
      ) : (
        <SessionHomeView
          sessions={sessionHistory}
          resumeSession={resumeSession}
          activeSessionId={session?.id ?? null}
          isSessionLoading={isSessionLoading}
          isCreatingSession={isCreatingSession}
          deletingSessionId={deletingSessionId}
          onCreateSession={handleCreateSession}
          onOpenSession={handleOpenSession}
          onDeleteSession={removeSession}
        />
      )}
    </main>
  );
}

export default App;
