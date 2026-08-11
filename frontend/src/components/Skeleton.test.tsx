import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton } from "./Skeleton";

describe("Skeleton", () => {
  it("renders an aria-hidden placeholder block", () => {
    const { container } = render(<Skeleton variant="row" />);
    const block = container.querySelector(".skeleton-block--row");
    expect(block).toBeInTheDocument();
    expect(block).toHaveAttribute("aria-hidden", "true");
  });

  it("applies the requested variant class", () => {
    const { container } = render(<Skeleton variant="card" />);
    expect(container.querySelector(".skeleton-block--card")).toBeInTheDocument();
  });
});
