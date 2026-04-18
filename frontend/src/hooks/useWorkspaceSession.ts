import { useEffect, useMemo, useState } from "react";

import { createSession, uploadDocuments } from "../api";
import type { DocumentResponse, SessionResponse } from "../types";

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

export function useWorkspaceSession() {
  const [session, setSession] = useState<SessionResponse | null>(bootstrappedSession);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    bootstrappedSession?.documents[0]?.id ?? null,
  );
  const [isSessionLoading, setIsSessionLoading] = useState(bootstrappedSession === null);
  const [isUploading, setIsUploading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

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

  const documents = useMemo(() => sortDocuments(session?.documents ?? []), [session]);
  const selectedDocument =
    documents.find((document) => document.id === selectedDocumentId) ?? null;

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
      bootstrappedSession = nextSession;
      setSession(nextSession);
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

  return {
    session,
    documents,
    selectedDocument,
    selectedDocumentId,
    isSessionLoading,
    isUploading,
    sessionError,
    uploadError,
    selectDocument: setSelectedDocumentId,
    uploadFiles,
  };
}
