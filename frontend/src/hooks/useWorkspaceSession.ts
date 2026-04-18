import { useEffect, useMemo, useState } from "react";

import {
  createSession,
  rerunDocumentAutoDetect,
  updateDocumentTransform,
  uploadDocuments,
} from "../api";
import type { CropRect, DocumentResponse, Point, SessionResponse } from "../types";

let bootstrapSessionPromise: Promise<SessionResponse> | null = null;
let bootstrappedSession: SessionResponse | null = null;

type DocumentAction = "save" | "reset" | "auto-detect";

interface ActiveDocumentAction {
  action: DocumentAction;
  documentId: string;
}

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
  const [activeDocumentAction, setActiveDocumentAction] =
    useState<ActiveDocumentAction | null>(null);

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
    }));
  }, [session]);
  const selectedDocument =
    documents.find((document) => document.id === selectedDocumentId) ?? null;

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

  async function savePerspective(documentId: string, userCorners: Point[], cropRect: CropRect) {
    setActiveDocumentAction({ action: "save", documentId });
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
    setActiveDocumentAction({ action: "reset", documentId });
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
    activeDocumentAction,
    selectDocument: setSelectedDocumentId,
    uploadFiles,
    savePerspective,
    resetPerspective,
    rerunAutoDetect,
  };
}
