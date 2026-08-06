interface FeedbackPanelProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}

export function FeedbackPanel({
  title,
  message,
  actionLabel,
  onAction,
  onDismiss,
}: FeedbackPanelProps) {
  return (
    <section className="feedback-panel feedback-panel--error" role="alert">
      <div className="feedback-panel-heading">
        <h2>{title}</h2>
        {onDismiss ? (
          <button
            className="feedback-dismiss"
            type="button"
            aria-label={`Dismiss ${title.toLowerCase()}`}
            onClick={onDismiss}
          >
            <span aria-hidden="true">×</span>
          </button>
        ) : null}
      </div>
      <p>{message}</p>
      {actionLabel && onAction ? (
        <button className="secondary-action" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}
