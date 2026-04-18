import type { SessionResponse } from "./types";

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}.`;

    try {
      const errorBody = (await response.json()) as { detail?: string };
      if (typeof errorBody.detail === "string" && errorBody.detail.trim().length > 0) {
        detail = errorBody.detail;
      }
    } catch {
      // Ignore non-JSON error bodies and fall back to the default message.
    }

    throw new Error(detail);
  }

  return (await response.json()) as T;
}

export function createSession(): Promise<SessionResponse> {
  return requestJson<SessionResponse>("/api/sessions", {
    method: "POST",
  });
}

export function getSession(sessionId: string): Promise<SessionResponse> {
  return requestJson<SessionResponse>(`/api/sessions/${sessionId}`);
}

export function uploadDocuments(
  sessionId: string,
  files: File[],
): Promise<SessionResponse> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  return requestJson<SessionResponse>(`/api/sessions/${sessionId}/documents`, {
    method: "POST",
    body: formData,
  });
}
