interface SkeletonProps {
  variant?: "row" | "card" | "preview";
}

export function Skeleton({ variant = "row" }: SkeletonProps) {
  return <div aria-hidden="true" className={`skeleton-block skeleton-block--${variant}`} />;
}
