import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const stylesCss = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function topLevelBlocks(css: string): Array<{ selector: string; body: string }> {
  const clean = stripComments(css);
  const blocks: Array<{ selector: string; body: string }> = [];
  let index = 0;

  while (index < clean.length) {
    const open = clean.indexOf("{", index);
    if (open === -1) {
      break;
    }

    let depth = 1;
    let cursor = open + 1;
    while (cursor < clean.length && depth > 0) {
      if (clean[cursor] === "{") {
        depth += 1;
      } else if (clean[cursor] === "}") {
        depth -= 1;
      }
      cursor += 1;
    }

    blocks.push({
      selector: clean.slice(index, open).trim(),
      body: clean.slice(open + 1, cursor - 1),
    });
    index = cursor;
  }

  return blocks;
}

function findRule(css: string, selector: string): string | null {
  for (const block of topLevelBlocks(css)) {
    if (block.selector.includes(selector)) {
      return block.body;
    }
    const nested = findRule(block.body, selector);
    if (nested !== null) {
      return nested;
    }
  }
  return null;
}

function mediaBody(query: string): string | null {
  return findRule(stylesCss, `@media ${query}`);
}

describe("responsive layout contract (styles.css)", () => {
  it("keeps the editor mode tabs on one row with horizontal scrolling", () => {
    const switcher = findRule(stylesCss, ".tool-mode-switcher");
    expect(switcher).not.toBeNull();
    expect(switcher).toContain("flex-wrap: nowrap");
    expect(switcher).toContain("overflow-x: auto");
    expect(switcher).toContain("max-width: 100%");
  });

  it("collapses the workspace grid to one column at the tablet breakpoint", () => {
    const tablet = mediaBody("(max-width: 1024px)");
    expect(tablet).not.toBeNull();
    const workspaceBody = findRule(tablet ?? "", ".workspace-body");
    expect(workspaceBody).not.toBeNull();
    expect(workspaceBody).toContain("grid-template-columns: 1fr");
  });

  it("places the editor panel before the sidebar on narrow screens", () => {
    const tablet = mediaBody("(max-width: 1024px)");
    expect(tablet).not.toBeNull();
    const editorOrder = findRule(tablet ?? "", ".workspace-body .editor-panel");
    expect(editorOrder).not.toBeNull();
    expect(editorOrder).toContain("order: -1");
  });

  it("prevents horizontal page overflow", () => {
    const bodyRule = findRule(stylesCss, "html");
    expect(bodyRule).not.toBeNull();
    expect(bodyRule).toContain("overflow-x: clip");
  });

  it("gives primary and secondary actions a consistent touch target height", () => {
    const actions = findRule(stylesCss, ".primary-action");
    expect(actions).not.toBeNull();
    expect(actions).toContain("min-height: 48px");
  });

  it("lets header actions wrap in a row on mobile", () => {
    const mobile = mediaBody("(max-width: 768px)");
    expect(mobile).not.toBeNull();
    const actions = findRule(mobile ?? "", ".workspace-actions");
    expect(actions).not.toBeNull();
    expect(actions).toContain("flex-wrap: wrap");
    const buttons = findRule(mobile ?? "", ".workspace-actions button");
    expect(buttons).not.toBeNull();
    expect(buttons).toContain("width: auto");
  });

  it("aligns export buttons with a consistent stretch layout", () => {
    const exportActions = findRule(stylesCss, ".export-actions");
    expect(exportActions).not.toBeNull();
    expect(exportActions).toContain("align-items: stretch");
  });

  it("compacts the header and editor frames on short viewports", () => {
    const short = mediaBody("(max-height: 520px)");
    expect(short).not.toBeNull();
    const header = findRule(short ?? "", ".workspace-header");
    expect(header).not.toBeNull();
    expect(header).toContain("padding: 16px 20px");
    const frames = findRule(short ?? "", ".source-editor-frame");
    expect(frames).not.toBeNull();
    expect(frames).toContain("min-height: 120px");
  });

  it("keeps history rows free of raw session ids", () => {
    const homeView = findRule(stylesCss, ".session-home");
    expect(homeView).not.toBeNull();
    expect(homeView).toContain("align-content: center");
    expect(stylesCss).not.toMatch(/\.session-row-id/);
  });
});
