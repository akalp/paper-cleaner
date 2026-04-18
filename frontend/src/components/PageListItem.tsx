import type { DocumentResponse } from "../types";

interface PageListItemProps {
  document: DocumentResponse;
  index: number;
  isSelected: boolean;
  onSelect: (documentId: string) => void;
}

export function PageListItem({
  document,
  index,
  isSelected,
  onSelect,
}: PageListItemProps) {
  return (
    <li>
      <button
        className={`page-list-item${isSelected ? " is-selected" : ""}`}
        type="button"
        onClick={() => onSelect(document.id)}
      >
        <span className="page-order">{index + 1}</span>
        <span className="page-copy">
          <span className="page-name">{document.filename}</span>
          <span className="page-meta">Preview ready</span>
        </span>
      </button>
    </li>
  );
}
