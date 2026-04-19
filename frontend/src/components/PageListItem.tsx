import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { DocumentResponse } from "../types";

interface PageListItemProps {
  document: DocumentResponse;
  index: number;
  isSelected: boolean;
  isReordering: boolean;
  onSelect: (documentId: string) => void;
}

export function PageListItem({
  document,
  index,
  isSelected,
  isReordering,
  onSelect,
}: PageListItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: document.id,
    disabled: isReordering,
  });

  return (
    <li
      ref={setNodeRef}
      className={`page-list-row${isDragging ? " is-dragging" : ""}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <button
        className="page-drag-handle"
        type="button"
        disabled={isReordering}
        {...attributes}
        {...listeners}
      >
        <span aria-hidden="true">::</span>
        <span className="sr-only">Reorder {document.filename}</span>
      </button>
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
