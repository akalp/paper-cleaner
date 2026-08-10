export function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatPageCount(count: number): string {
  if (count === 1) {
    return "1 page";
  }

  return `${count} pages`;
}
