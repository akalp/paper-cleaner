import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { EmptyPanel } from "./EmptyPanel";
import { PageListItem } from "./PageListItem";
import type { DocumentResponse } from "../types";

interface PageSidebarProps {
  documents: DocumentResponse[];
  selectedDocumentId: string | null;
  isSessionLoading: boolean;
  isReordering: boolean;
  onSelectDocument: (documentId: string) => void;
  onReorderDocuments: (documentIds: string[]) => Promise<void>;
}

export function PageSidebar({
  documents,
  selectedDocumentId,
  isSessionLoading,
  isReordering,
  onSelectDocument,
  onReorderDocuments,
}: PageSidebarProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over === null || active.id === over.id) {
      return;
    }

    const oldIndex = documents.findIndex((document) => document.id === active.id);
    const newIndex = documents.findIndex((document) => document.id === over.id);
    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const reorderedIds = arrayMove(
      documents.map((document) => document.id),
      oldIndex,
      newIndex,
    );
    void onReorderDocuments(reorderedIds);
  }

  return (
    <aside className="sidebar" aria-label="Uploaded pages">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Pages</p>
          <h2>Session documents</h2>
        </div>
        <span className="panel-count">{documents.length}</span>
      </div>

      {isSessionLoading ? (
        <EmptyPanel
          title="Preparing workspace"
          message="Creating a fresh local session for this editing run."
        />
      ) : documents.length === 0 ? (
        <EmptyPanel
          title="No pages yet"
          message="Upload one or more document images to start browsing them here."
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={documents.map((document) => document.id)}
            strategy={verticalListSortingStrategy}
          >
            <ol className="page-list">
              {documents.map((document, index) => (
                <PageListItem
                  key={document.id}
                  document={document}
                  index={index}
                  isSelected={document.id === selectedDocumentId}
                  isReordering={isReordering}
                  onSelect={onSelectDocument}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}
    </aside>
  );
}
