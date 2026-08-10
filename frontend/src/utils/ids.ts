export function createId(): string {
  const uuid = globalThis.crypto?.randomUUID;
  if (typeof uuid === "function") {
    return uuid.call(globalThis.crypto);
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
