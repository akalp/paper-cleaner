import { useEffect, useMemo, useState } from "react";

import {
  createSession,
  deleteSession,
  exportDocumentImage,
  exportSessionPdf,
  exportSessionZip,
  getSession,
  listSessions,
  rerunDocumentAutoDetect,
  reorderSessionDocuments,
  updateDocumentErase,
  updateDocumentTone,
  updateDocumentTransform,
  uploadDocuments,
} from "../api";
import type {
  ActiveDocumentAction,
  CropRect,
  DocumentResponse,
  ErasePath,
  ExportAction,
  ExportFileResponse,
  Point,
  SessionResponse,
  SessionSummary,
  TonePreset,
} from "../types";

const ACTIVE_SESSION_STORAGE_KEY = "paper-cleaner.activeSessionId";

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

function readStoredSessionId(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredSessionId(sessionId: string) {
  try {
    window.localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, sessionId);
  } catch {
    // The active session can still work for the current page if localStorage is unavailable.
  }
}

function clearStoredSessionId() {
  try {
    window.localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage failures; the in-memory state is still cleared.
  }
}

function isMissingSessionError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("was not found");
}

function sortDocuments(documents: DocumentResponse[]): DocumentResponse[] {
  return [...documents].sort((left, right) => left.order_index - right.order_index);
}

function buildCacheBustedPreviewUrl(previewUrl: string, token: string): string {
  const previewLocation = new URL(previewUrl, window.location.origin);
  previewLocation.searchParams.set("v", token);
  return `${previewLocation.pathname}${previewLocation.search}`;
}

function downloadExportFile(file: ExportFileResponse) {
  const objectUrl = URL.createObjectURL(file.blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = file.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export function useWorkspaceSession() {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [sessionHistory, setSessionHistory] = useState<SessionSummary[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [documentActionError, setDocumentActionError] = useState<string | null>(null);
  const [workspaceActionError, setWorkspaceActionError] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [activeExportAction, setActiveExportAction] = useState<ExportAction | null>(null);
  const [activeDocumentAction, setActiveDocumentAction] = useState<ActiveDocumentAction | null>(
    null,
  );

  useEffect(() => {
    let isMounted = true;

    async function initializeSession() {
      setIsSessionLoading(true);
      setSessionError(null);

      try {
        const history = await listSessions();
        if (!isMounted) {
          return;
        }
        setSessionHistory(history.sessions);

        const storedSessionId = readStoredSessionId();
        if (storedSessionId === null) {
          setSession(null);
          setSelectedDocumentId(null);
          return;
        }

        try {
          const restoredSession = await getSession(storedSessionId);
          if (!isMounted) {
            return;
          }
          activateSession(restoredSession);
        } catch (error) {
          if (!isMounted) {
            return;
          }
          clearStoredSessionId();
          setSession(null);
          setSelectedDocumentId(null);
          if (!isMissingSessionError(error)) {
            setSessionError(getErrorMessage(error, "Could not restore the previous session."));
          }
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setSession(null);
        setSelectedDocumentId(null);
        setSessionError(getErrorMessage(error, "Could not load session history."));
      } finally {
        if (isMounted) {
          setIsSessionLoading(false);
        }
      }
    }

    void initializeSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const documents = useMemo(() => {
    return sortDocuments(session?.documents ?? []).map((document) => ({
      ...document,
      preview_url: buildCacheBustedPreviewUrl(document.preview_url, document.preview_version),
      transformed_preview_url: buildCacheBustedPreviewUrl(
        document.transformed_preview_url,
        document.preview_version,
      ),
    }));
  }, [session]);
  const selectedDocument = documents.find((document) => document.id === selectedDocumentId) ?? null;

  function activateSession(nextSession: SessionResponse, preferredDocumentId?: string | null) {
    writeStoredSessionId(nextSession.id);
    setSession(nextSession);
    setSelectedDocumentId(() => {
      if (
        preferredDocumentId !== undefined &&
        preferredDocumentId !== null &&
        nextSession.documents.some((document) => document.id === preferredDocumentId)
      ) {
        return preferredDocumentId;
      }

      return nextSession.documents[0]?.id ?? null;
    });
  }

  function clearActiveSession() {
    clearStoredSessionId();
    setSession(null);
    setSelectedDocumentId(null);
  }

  async function refreshSessionHistory() {
    const history = await listSessions();
    setSessionHistory(history.sessions);
  }

  async function createNewSession() {
    setIsCreatingSession(true);
    setWorkspaceActionError(null);
    setSessionError(null);

    try {
      const nextSession = await createSession();
      activateSession(nextSession);
      await refreshSessionHistory();
    } catch (error) {
      setWorkspaceActionError(getErrorMessage(error, "Could not create a new session."));
    } finally {
      setIsCreatingSession(false);
    }
  }

  async function openSession(sessionId: string) {
    setIsSessionLoading(true);
    setWorkspaceActionError(null);
    setSessionError(null);

    try {
      const nextSession = await getSession(sessionId);
      activateSession(nextSession);
      await refreshSessionHistory();
    } catch (error) {
      if (isMissingSessionError(error)) {
        clearActiveSession();
        await refreshSessionHistory();
      }
      setWorkspaceActionError(getErrorMessage(error, "Could not open the selected session."));
    } finally {
      setIsSessionLoading(false);
    }
  }

  async function removeSession(sessionId: string) {
    setDeletingSessionId(sessionId);
    setWorkspaceActionError(null);

    try {
      await deleteSession(sessionId);
      if (session?.id === sessionId) {
        clearActiveSession();
      }
      await refreshSessionHistory();
    } catch (error) {
      setWorkspaceActionError(getErrorMessage(error, "Could not delete the session."));
    } finally {
      setDeletingSessionId(null);
    }
  }

  function mergeSession(nextSession: SessionResponse) {
    const preferredDocumentId = selectedDocumentId;
    activateSession(nextSession, preferredDocumentId);
  }

  function mergeDocument(nextDocument: DocumentResponse) {
    setSession((currentSession) => {
      if (currentSession === null) {
        return currentSession;
      }

      return {
        ...currentSession,
        documents: currentSession.documents.map((document) =>
          document.id === nextDocument.id ? nextDocument : document,
        ),
      };
    });
  }

  async function uploadFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }

    if (session === null) {
      setUploadError("Create or open a session before uploading images.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const nextSession = await uploadDocuments(session.id, files);
      mergeSession(nextSession);
      setSelectedDocumentId((currentSelectedId) => {
        if (currentSelectedId !== null) {
          const currentStillExists = nextSession.documents.some(
            (document) => document.id === currentSelectedId,
          );
          if (currentStillExists) {
            return currentSelectedId;
          }
        }

        return nextSession.documents[0]?.id ?? null;
      });
      await refreshSessionHistory();
    } catch (error) {
      setUploadError(getErrorMessage(error, "Upload failed."));
    } finally {
      setIsUploading(false);
    }
  }

  async function reorderDocuments(documentIds: string[]) {
    if (session === null) {
      setWorkspaceActionError("Reordering is unavailable until a session is ready.");
      return;
    }

    const currentDocumentIds = documents.map((document) => document.id);
    if (documentIds.join("|") === currentDocumentIds.join("|")) {
      return;
    }

    setIsReordering(true);
    setWorkspaceActionError(null);

    try {
      const nextSession = await reorderSessionDocuments(session.id, documentIds);
      mergeSession(nextSession);
      await refreshSessionHistory();
    } catch (error) {
      setWorkspaceActionError(getErrorMessage(error, "Could not reorder pages."));
    } finally {
      setIsReordering(false);
    }
  }

  async function savePerspective(documentId: string, userCorners: Point[], cropRect: CropRect) {
    setActiveDocumentAction({ action: "save-perspective", documentId });
    setDocumentActionError(null);

    try {
      const nextDocument = await updateDocumentTransform(documentId, {
        user_corners: userCorners,
        crop_rect: cropRect,
      });
      mergeDocument(nextDocument);
      void refreshSessionHistory();
    } catch (error) {
      setDocumentActionError(getErrorMessage(error, "Could not save perspective changes."));
    } finally {
      setActiveDocumentAction(null);
    }
  }

  async function resetPerspective(documentId: string, cropRect: CropRect) {
    setActiveDocumentAction({ action: "reset-perspective", documentId });
    setDocumentActionError(null);

    try {
      const nextDocument = await updateDocumentTransform(documentId, {
        user_corners: null,
        crop_rect: cropRect,
      });
      mergeDocument(nextDocument);
      void refreshSessionHistory();
    } catch (error) {
      setDocumentActionError(getErrorMessage(error, "Could not reset perspective changes."));
    } finally {
      setActiveDocumentAction(null);
    }
  }

  async function rerunAutoDetect(documentId: string) {
    setActiveDocumentAction({ action: "auto-detect", documentId });
    setDocumentActionError(null);

    try {
      const nextDocument = await rerunDocumentAutoDetect(documentId, {
        apply_to_user_corners: true,
      });
      mergeDocument(nextDocument);
      void refreshSessionHistory();
    } catch (error) {
      setDocumentActionError(getErrorMessage(error, "Could not re-run auto-detect."));
    } finally {
      setActiveDocumentAction(null);
    }
  }

  async function saveCrop(documentId: string, userCorners: Point[] | null, cropRect: CropRect) {
    setActiveDocumentAction({ action: "save-crop", documentId });
    setDocumentActionError(null);

    try {
      const nextDocument = await updateDocumentTransform(documentId, {
        user_corners: userCorners,
        crop_rect: cropRect,
      });
      mergeDocument(nextDocument);
      void refreshSessionHistory();
    } catch (error) {
      setDocumentActionError(getErrorMessage(error, "Could not save crop changes."));
    } finally {
      setActiveDocumentAction(null);
    }
  }

  async function resetCrop(documentId: string, userCorners: Point[] | null, cropRect: CropRect) {
    setActiveDocumentAction({ action: "reset-crop", documentId });
    setDocumentActionError(null);

    try {
      const nextDocument = await updateDocumentTransform(documentId, {
        user_corners: userCorners,
        crop_rect: cropRect,
      });
      mergeDocument(nextDocument);
      void refreshSessionHistory();
    } catch (error) {
      setDocumentActionError(getErrorMessage(error, "Could not reset crop."));
    } finally {
      setActiveDocumentAction(null);
    }
  }

  async function saveTone(
    documentId: string,
    tonePreset: TonePreset,
    brightness: number,
    contrast: number,
  ) {
    setActiveDocumentAction({ action: "save-tone", documentId });
    setDocumentActionError(null);

    try {
      const nextDocument = await updateDocumentTone(documentId, {
        tone_preset: tonePreset,
        brightness,
        contrast,
      });
      mergeDocument(nextDocument);
      void refreshSessionHistory();
    } catch (error) {
      setDocumentActionError(getErrorMessage(error, "Could not save tone changes."));
    } finally {
      setActiveDocumentAction(null);
    }
  }

  async function resetTone(documentId: string) {
    setActiveDocumentAction({ action: "reset-tone", documentId });
    setDocumentActionError(null);

    try {
      const nextDocument = await updateDocumentTone(documentId, {
        tone_preset: "printer_friendly",
        brightness: 0,
        contrast: 0,
      });
      mergeDocument(nextDocument);
      void refreshSessionHistory();
    } catch (error) {
      setDocumentActionError(getErrorMessage(error, "Could not reset tone settings."));
    } finally {
      setActiveDocumentAction(null);
    }
  }

  async function saveErase(documentId: string, erasePaths: ErasePath[]) {
    setActiveDocumentAction({ action: "save-erase", documentId });
    setDocumentActionError(null);

    try {
      const nextDocument = await updateDocumentErase(documentId, {
        erase_paths: erasePaths,
      });
      mergeDocument(nextDocument);
      void refreshSessionHistory();
    } catch (error) {
      setDocumentActionError(getErrorMessage(error, "Could not save erase changes."));
    } finally {
      setActiveDocumentAction(null);
    }
  }

  async function exportCurrentDocument() {
    if (selectedDocument === null) {
      setWorkspaceActionError("Select a page before exporting the current page.");
      return;
    }

    setActiveExportAction("page-image");
    setWorkspaceActionError(null);

    try {
      downloadExportFile(await exportDocumentImage(selectedDocument.id));
    } catch (error) {
      setWorkspaceActionError(getErrorMessage(error, "Could not export the current page."));
    } finally {
      setActiveExportAction(null);
    }
  }

  async function exportZip() {
    if (session === null) {
      setWorkspaceActionError("ZIP export is unavailable until a session is ready.");
      return;
    }

    setActiveExportAction("zip");
    setWorkspaceActionError(null);

    try {
      downloadExportFile(await exportSessionZip(session.id));
    } catch (error) {
      setWorkspaceActionError(getErrorMessage(error, "Could not export the ZIP archive."));
    } finally {
      setActiveExportAction(null);
    }
  }

  async function exportPdf() {
    if (session === null) {
      setWorkspaceActionError("PDF export is unavailable until a session is ready.");
      return;
    }

    setActiveExportAction("pdf");
    setWorkspaceActionError(null);

    try {
      downloadExportFile(await exportSessionPdf(session.id));
    } catch (error) {
      setWorkspaceActionError(getErrorMessage(error, "Could not export the PDF."));
    } finally {
      setActiveExportAction(null);
    }
  }

  return {
    session,
    sessionHistory,
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
    createNewSession,
    openSession,
    removeSession,
    selectDocument: setSelectedDocumentId,
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
  };
}
