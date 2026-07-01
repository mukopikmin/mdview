import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PreviewComment } from "../comments";
import { MarkdownPreview } from "../MarkdownPreview";

afterEach(() => cleanup());

const renderMarkdown = (
  markdown: string,
  comments: PreviewComment[] = [],
  callbacks: Partial<{
    onCreateComment: (
      line: number,
      body: string,
      endLine?: number,
    ) => Promise<void>;
    onResolveComment: (id: number) => Promise<void>;
  }> = {},
) => {
  const result = render(
    <MarkdownPreview
      comments={comments}
      markdown={markdown}
      onCreateComment={callbacks.onCreateComment ?? (async () => {})}
      onDeleteComment={async () => {}}
      onDeleteReply={async () => {}}
      onReplyComment={async () => {}}
      onResolveComment={callbacks.onResolveComment ?? (async () => {})}
      onUpdateComment={async () => {}}
      onUpdateReply={async () => {}}
    />,
  );
  return { ...result, container: result.container };
};

describe("MarkdownPreview", () => {
  it("renders common Markdown blocks", () => {
    const { container } = renderMarkdown(`# Title

Hello **world** and *friends*.

- one
- two

\`\`\`js
console.log("<ok>");
\`\`\`
`);

    expect(container.querySelector("h1#title .heading-anchor")?.textContent)
      .toBe("Title");
    expect(container.querySelector("strong")?.textContent).toBe("world");
    expect(container.querySelectorAll("ul > li")).toHaveLength(2);
    expect(container.querySelector("code.hljs.language-js")?.innerHTML)
      .toContain("console");
  });

  it("renders stable heading anchor links", () => {
    const { container } = renderMarkdown(`# Title!

## Title!

### **Rich** \`Heading\`
`);

    expect(container.querySelector("h1#title a.heading-anchor")?.textContent)
      .toBe("Title!");
    expect(container.querySelector("h2#title-1 a.heading-anchor")?.textContent)
      .toBe("Title!");
    expect(
      container.querySelector("h3#rich-heading a.heading-anchor")?.textContent,
    ).toBe("Rich Heading");
  });

  it("escapes raw html", () => {
    const { container } = renderMarkdown("<script>alert(1)</script>");

    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toBe("<script>alert(1)</script>");
  });

  it("renders links and images with titles", () => {
    const { container } = renderMarkdown(
      '[site](https://example.com "Site title") ![logo](logo.png "Logo title")',
    );

    const link = screen.getByRole("link", { name: "site" });
    const image = screen.getByRole("img", { name: "logo" });

    expect(link.getAttribute("href")).toBe("https://example.com");
    expect(link.getAttribute("title")).toBe("Site title");
    expect(image.getAttribute("src")).toBe("logo.png");
    expect(image.getAttribute("title")).toBe("Logo title");
    expect(container.querySelector("p")).not.toBeNull();
  });

  it("autolinks plain urls", () => {
    renderMarkdown("Visit https://example.com/path?q=1.");

    expect(screen.getByRole("link").getAttribute("href")).toBe(
      "https://example.com/path?q=1",
    );
  });

  it("renders markdown tables", () => {
    const { container } = renderMarkdown(`| Name | Count |
| ---- | ----: |
| alpha | 1 |
| **beta** | 20 |
`);

    expect(container.querySelector("table")).not.toBeNull();
    expect(container.querySelector("th")?.textContent).toBe("Name");
    expect(container.querySelector('th[style*="text-align: right"]'))
      .not.toBeNull();
    expect(container.querySelector("td strong")?.textContent).toBe("beta");
  });

  it("renders nested lists inside parent list items", () => {
    const { container } = renderMarkdown(`- parent
  - child
    1. ordered child
- sibling
`);

    expect(container.querySelector("ul ul ol li")?.textContent).toBe(
      "ordered child",
    );
    expect(container.querySelectorAll("ul > li")).toHaveLength(3);
    const listCommentTarget = container.querySelector(
      "li > .commentable-list-item",
    );
    expect(listCommentTarget).not.toBeNull();
    expect(listCommentTarget?.classList.contains("commentable-block")).toBe(
      true,
    );
  });

  it("renders task list checkboxes", () => {
    const { container } = renderMarkdown(`- [ ] todo
- [x] done
- [X] also done
`);

    const checkboxes = container.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    expect(checkboxes).toHaveLength(3);
    expect(checkboxes[0].checked).toBe(false);
    expect(checkboxes[1].checked).toBe(true);
    expect(checkboxes[2].checked).toBe(true);
    expect(container.querySelector(".task-list-item")).not.toBeNull();
  });

  it("highlights Kotlin code fences", () => {
    const { container } = renderMarkdown(`\`\`\`kotlin
fun main() {
    println("Hello")
}
\`\`\`
`);

    expect(container.querySelector("code.hljs.language-kotlin")).not.toBeNull();
    expect(container.querySelector(".hljs-keyword")?.textContent).toBe("fun");
  });

  it("adds source line controls to code fences", () => {
    const { container } = renderMarkdown(`\`\`\`ts
const value = 1;
\`\`\`
`);

    expect(
      container.querySelector('[data-source-line="1"] pre code.language-ts'),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Add comment on line 1" }),
    ).not.toBeNull();
  });

  it("renders mermaid code fences for browser-side diagrams", () => {
    const { container } = renderMarkdown(`\`\`\`mermaid
graph TD
  A --> B
\`\`\`
`);

    const mermaid = container.querySelector(".mermaid-container pre.mermaid");
    expect(mermaid).not.toBeNull();
    expect(mermaid?.textContent).toBe("graph TD\n  A --> B");
    expect(
      screen.getByRole("button", { name: "Zoom Mermaid diagram" }),
    ).not.toBeNull();
  });

  it("does not render Mermaid zoom buttons for regular code fences", () => {
    renderMarkdown(`\`\`\`ts
const value = 1;
\`\`\`
`);

    expect(
      screen.queryByRole("button", { name: "Zoom Mermaid diagram" }),
    ).toBeNull();
  });

  it("renders longer code fences without treating nested shorter fences as blocks", () => {
    const { container } = renderMarkdown(`\`\`\`\`md
\`\`\`mermaid
graph TD
  A --> B
\`\`\`
\`\`\`\`
`);

    expect(container.querySelector("code.hljs.language-md")).not.toBeNull();
    expect(container.textContent).toContain("```mermaid");
    expect(container.textContent).toContain("A --> B");
  });

  it("adds source line controls to rendered Markdown blocks", () => {
    const { container } = renderMarkdown(`# Title

Body
`);

    expect(container.querySelector('[data-source-line="1"] h1')?.textContent)
      .toBe("Title");
    expect(
      screen.getByRole("button", { name: "Add comment on line 1" }),
    ).not.toBeNull();
    expect(container.querySelector('[data-source-line="3"] p')?.textContent)
      .toBe("Body");
  });

  it("focuses the comment textarea when opening the comment form", () => {
    renderMarkdown("# Title\n");

    fireEvent.click(
      screen.getByRole("button", { name: "Add comment on line 1" }),
    );

    expect(document.activeElement).toBe(
      screen.getByPlaceholderText("Write a GitHub PR comment..."),
    );
  });

  it("submits a new comment with command or control enter", async () => {
    const onCreateComment = vi.fn(async () => {});
    renderMarkdown("# Title\n\nBody\n", [], { onCreateComment });

    fireEvent.click(
      screen.getByRole("button", { name: "Add comment on line 1" }),
    );
    fireEvent.change(
      screen.getByPlaceholderText("Write a GitHub PR comment..."),
      { target: { value: "Mac shortcut." } },
    );
    fireEvent.keyDown(
      screen.getByPlaceholderText("Write a GitHub PR comment..."),
      { key: "Enter", metaKey: true },
    );

    await waitFor(() =>
      expect(onCreateComment).toHaveBeenCalledWith(1, "Mac shortcut.", 1)
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Add comment on line 3" }),
    );
    fireEvent.change(
      screen.getByPlaceholderText("Write a GitHub PR comment..."),
      { target: { value: "Control shortcut." } },
    );
    fireEvent.keyDown(
      screen.getByPlaceholderText("Write a GitHub PR comment..."),
      { key: "Enter", ctrlKey: true },
    );

    await waitFor(() =>
      expect(onCreateComment).toHaveBeenCalledWith(3, "Control shortcut.", 3)
    );
  });

  it("does not add duplicate source line controls for blockquotes", () => {
    const { container } = renderMarkdown(`> Quoted text
`);

    expect(container.querySelector("blockquote p")?.textContent).toBe(
      "Quoted text",
    );
    expect(container.querySelectorAll('[data-source-line="1"]')).toHaveLength(
      1,
    );
    expect(
      screen.getAllByRole("button", { name: "Add comment on line 1" }),
    ).toHaveLength(1);
  });

  it("does not add duplicate source line controls for loose list paragraphs", () => {
    const { container } = renderMarkdown(`- Parent item

  More detail
`);

    expect(container.querySelector("li p")?.textContent).toBe("Parent item");
    expect(container.querySelectorAll('[data-source-line="1"]')).toHaveLength(
      1,
    );
    expect(
      screen.getAllByRole("button", { name: "Add comment on line 1" }),
    ).toHaveLength(1);
    expect(container.querySelectorAll('[data-source-line="3"]')).toHaveLength(
      1,
    );
    expect(
      screen.getAllByRole("button", { name: "Add comment on line 3" }),
    ).toHaveLength(1);
  });

  it("shows range comments on every covered preview line", () => {
    renderMarkdown("# Title\n\nBody\n\nTail\n", [{
      body: "Range comment.",
      createdAt: "2026-06-05T00:00:00.000Z",
      id: 1,
      line: 1,
      endLine: 3,
      originalLine: 1,
      originalEndLine: 3,
      resolved: false,
      sourceHash: "example",
      sourceText: "# Title\n\nBody",
      stale: false,
      updatedAt: "2026-06-05T00:00:00.000Z",
    }]);

    expect(screen.getAllByText("Lines 1-3")).toHaveLength(2);
    expect(screen.getAllByText("Range comment.")).toHaveLength(2);
  });

  it("resolves inline comments from the preview", async () => {
    const onResolveComment = vi.fn(async () => {});
    renderMarkdown("# Title\n\nBody\n", [{
      body: "Clarify this.",
      createdAt: "2026-06-05T00:00:00.000Z",
      id: 1,
      line: 3,
      endLine: 3,
      originalLine: 3,
      originalEndLine: 3,
      resolved: false,
      sourceHash: "example",
      sourceText: "Body",
      stale: false,
      updatedAt: "2026-06-05T00:00:00.000Z",
    }], { onResolveComment });

    screen.getByRole("button", { name: "Resolve" }).click();

    await waitFor(() => expect(onResolveComment).toHaveBeenCalledWith(1));
  });
});
