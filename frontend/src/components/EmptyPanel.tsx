interface EmptyPanelProps {
  title: string;
  message: string;
  large?: boolean;
}

export function EmptyPanel({ title, message, large = false }: EmptyPanelProps) {
  return (
    <div className={`empty-panel${large ? " empty-panel--large" : ""}`}>
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}
