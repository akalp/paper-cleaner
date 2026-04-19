interface FeedbackPanelProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function FeedbackPanel({ title, message, actionLabel, onAction }: FeedbackPanelProps) {
  return (
    <section className="feedback-panel feedback-panel--error" role="alert">
      <h2>{title}</h2>
      <p>{message}</p>
      {actionLabel && onAction ? (
        <button className="secondary-action" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}
