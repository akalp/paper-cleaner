import { EmptyPanel } from "./EmptyPanel";
import { PageListItem } from "./PageListItem";
import type { DocumentResponse } from "../types";

interface PageSidebarProps {
  documents: DocumentResponse[];
  selectedDocumentId: string | null;
  isSessionLoading: boolean;
  onSelectDocument: (documentId: string) => void;
}

export function PageSidebar({
  documents,
  selectedDocumentId,
  isSessionLoading,
  onSelectDocument,
}: PageSidebarProps) {
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
        <ol className="page-list">
          {documents.map((document, index) => (
            <PageListItem
              key={document.id}
              document={document}
              index={index}
              isSelected={document.id === selectedDocumentId}
              onSelect={onSelectDocument}
            />
          ))}
        </ol>
      )}
    </aside>
  );
}
