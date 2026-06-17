import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PreviewComment } from "../comments";
import { MarkdownPreview } from "../MarkdownPreview";

afterEach(() => cleanup());

const renderMarkdown = (
  markdown: string,
  comments: PreviewComment[] = [],
  callbacks: Partial<{
    onResolveComment: (id: string) => Promise<void>;
  }> = {},
) => {
  const result = render(
    <MarkdownPreview
      comments={comments}
      markdown={markdown}
      onCreateComment={async () => {}}
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

    const mermaid = container.querySelector("pre.mermaid");
    expect(mermaid).not.toBeNull();
    expect(mermaid?.textContent).toBe("graph TD\n  A --> B");
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

  it("resolves inline comments from the preview", async () => {
    const onResolveComment = vi.fn(async () => {});
    renderMarkdown("# Title\n\nBody\n", [{
      body: "Clarify this.",
      createdAt: "2026-06-05T00:00:00.000Z",
      id: "comment-1",
      line: 3,
      originalLine: 3,
      resolved: false,
      sourceHash: "example",
      sourceText: "Body",
      stale: false,
      updatedAt: "2026-06-05T00:00:00.000Z",
    }], { onResolveComment });

    screen.getByRole("button", { name: "Resolve" }).click();

    await waitFor(() =>
      expect(onResolveComment).toHaveBeenCalledWith("comment-1")
    );
  });
});
