import { useRef } from "react";

import { FeedbackPanel } from "./components/FeedbackPanel";
import { PageSidebar } from "./components/PageSidebar";
import { SelectedPageEditor } from "./components/SelectedPageEditor";
import { WorkspaceHeader } from "./components/WorkspaceHeader";
import { useWorkspaceSession } from "./hooks/useWorkspaceSession";

function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const {
    session,
    documents,
    selectedDocument,
    selectedDocumentId,
    isSessionLoading,
    isUploading,
    sessionError,
    uploadError,
    documentActionError,
    workspaceActionError,
    isReordering,
    activeExportAction,
    activeDocumentAction,
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

      <WorkspaceHeader
        isSessionLoading={isSessionLoading}
        isUploading={isUploading}
        sessionId={session?.id ?? null}
        hasDocuments={documents.length > 0}
        selectedDocumentName={selectedDocument?.filename ?? null}
        activeExportAction={activeExportAction}
        onUploadClick={triggerFilePicker}
        onExportCurrentDocument={exportCurrentDocument}
        onExportZip={exportZip}
        onExportPdf={exportPdf}
      />

      {sessionError ? (
        <FeedbackPanel
          title="Session unavailable"
          message={sessionError}
          actionLabel="Retry"
          onAction={() => window.location.reload()}
        />
      ) : null}

      {uploadError ? <FeedbackPanel title="Upload failed" message={uploadError} /> : null}

      {documentActionError ? (
        <FeedbackPanel title="Document update failed" message={documentActionError} />
      ) : null}

      {workspaceActionError ? (
        <FeedbackPanel title="Workspace action failed" message={workspaceActionError} />
      ) : null}

      <section className="workspace-body">
        <PageSidebar
          documents={documents}
          selectedDocumentId={selectedDocumentId}
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
    </main>
  );
}

export default App;
