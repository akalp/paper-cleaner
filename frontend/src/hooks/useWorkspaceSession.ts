import { useEffect, useMemo, useState } from "react";

import {
  createSession,
  exportDocumentImage,
  exportSessionPdf,
  exportSessionZip,
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
  TonePreset,
} from "../types";

let bootstrapSessionPromise: Promise<SessionResponse> | null = null;
let bootstrappedSession: SessionResponse | null = null;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

function getOrCreateInitialSession(): Promise<SessionResponse> {
  if (bootstrappedSession !== null) {
    return Promise.resolve(bootstrappedSession);
  }

  if (bootstrapSessionPromise !== null) {
    return bootstrapSessionPromise;
  }

  bootstrapSessionPromise = createSession()
    .then((session) => {
      bootstrappedSession = session;
      return session;
    })
    .finally(() => {
      bootstrapSessionPromise = null;
    });

  return bootstrapSessionPromise;
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
  const [session, setSession] = useState<SessionResponse | null>(bootstrappedSession);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    bootstrappedSession?.documents[0]?.id ?? null,
  );
  const [isSessionLoading, setIsSessionLoading] = useState(bootstrappedSession === null);
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

    if (bootstrappedSession !== null) {
      return () => {
        isMounted = false;
      };
    }

    async function initializeSession() {
      setIsSessionLoading(true);
      setSessionError(null);

      try {
        const nextSession = await getOrCreateInitialSession();
        if (!isMounted) {
          return;
        }

        setSession(nextSession);
        setSelectedDocumentId((currentSelectedDocumentId) => {
          return currentSelectedDocumentId ?? nextSession.documents[0]?.id ?? null;
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setSession(null);
        setSelectedDocumentId(null);
        setSessionError(getErrorMessage(error, "Could not create a working session."));
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

  function mergeSession(nextSession: SessionResponse) {
    bootstrappedSession = nextSession;
    setSession(nextSession);
  }

  function mergeDocument(nextDocument: DocumentResponse) {
    setSession((currentSession) => {
      if (currentSession === null) {
        return currentSession;
      }

      const nextSession = {
        ...currentSession,
        documents: currentSession.documents.map((document) =>
          document.id === nextDocument.id ? nextDocument : document,
        ),
      };

      bootstrappedSession = nextSession;
      return nextSession;
    });
  }

  async function uploadFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }

    if (session === null) {
      setUploadError("Upload is unavailable until a session is ready.");
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
