import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyPanel } from "../components/EmptyPanel";

describe("EmptyPanel", () => {
  it("renders title and message", () => {
    render(<EmptyPanel title="No pages" message="Upload images to begin." />);
    expect(screen.getByRole("heading", { name: "No pages" })).toBeInTheDocument();
    expect(screen.getByText("Upload images to begin.")).toBeInTheDocument();
  });

  it("adds the large modifier when requested", () => {
    const { container } = render(<EmptyPanel title="Start" message="Go." large />);
    expect(container.querySelector(".empty-panel--large")).toBeInTheDocument();
  });
});
