import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommentList } from "../CommentList";
import type { PreviewComment } from "../comments";

afterEach(() => cleanup());

const createComment = (
  overrides: Partial<PreviewComment>,
): PreviewComment => ({
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
  ...overrides,
});

describe("CommentList", () => {
  it("groups active, stale, and resolved comments", () => {
    render(
      <CommentList
        comments={[
          createComment({ body: "Active comment.", id: "active" }),
          createComment({
            body: "Stale comment.",
            id: "stale",
            sourceText: "Old body",
            stale: true,
          }),
          createComment({
            body: "Resolved comment.",
            id: "resolved",
            resolved: true,
          }),
        ]}
        onDeleteComment={async () => {}}
        onDeleteReply={async () => {}}
        onReplyComment={async () => {}}
        onReopenComment={async () => {}}
        onResolveComment={async () => {}}
        onUpdateComment={async () => {}}
        onUpdateReply={async () => {}}
      />,
    );

    expect(screen.getByRole("heading", { name: "Active comments (1)" }))
      .not.toBeNull();
    expect(screen.getByRole("heading", { name: "Stale comments (1)" }))
      .not.toBeNull();
    expect(screen.getByRole("heading", { name: "Resolved comments (1)" }))
      .not.toBeNull();
    expect(screen.getByText("Active comment.")).not.toBeNull();
    expect(screen.getByText("Stale comment.")).not.toBeNull();
    expect(screen.getByText("Resolved comment.")).not.toBeNull();
    expect(screen.getByText("Stale")).not.toBeNull();
    expect(screen.getByText("Resolved")).not.toBeNull();
    expect(screen.getAllByText("Target line")).toHaveLength(2);
    expect(screen.getAllByText("Body")).toHaveLength(2);
    expect(screen.getByText("Original line")).not.toBeNull();
    expect(screen.getByText("Old body")).not.toBeNull();
  });

  it("updates and deletes comments", async () => {
    const onDeleteComment = vi.fn(async () => {});
    const onReopenComment = vi.fn(async () => {});
    const onReplyComment = vi.fn(async () => {});
    const onResolveComment = vi.fn(async () => {});
    const onUpdateComment = vi.fn(async () => {});
    render(
      <CommentList
        comments={[createComment({ body: "Original body." })]}
        onDeleteComment={onDeleteComment}
        onDeleteReply={async () => {}}
        onReplyComment={onReplyComment}
        onReopenComment={onReopenComment}
        onResolveComment={onResolveComment}
        onUpdateComment={onUpdateComment}
        onUpdateReply={async () => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(document.activeElement).toBe(screen.getByRole("textbox"));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Updated body." },
    });
    fireEvent.keyDown(screen.getByRole("textbox"), {
      ctrlKey: true,
      key: "Enter",
    });
    await waitFor(() =>
      expect(onUpdateComment).toHaveBeenCalledWith(
        "comment-1",
        "Updated body.",
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(onDeleteComment).toHaveBeenCalledWith("comment-1")
    );
  });

  it("shows and creates replies", async () => {
    const onDeleteReply = vi.fn(async () => {});
    const onReplyComment = vi.fn(async () => {});
    const onUpdateReply = vi.fn(async () => {});
    render(
      <CommentList
        comments={[createComment({
          replies: [{
            body: "Existing reply.",
            createdAt: "2026-06-05T01:00:00.000Z",
            id: "reply-1",
            updatedAt: "2026-06-05T01:00:00.000Z",
          }],
        })]}
        onDeleteComment={async () => {}}
        onDeleteReply={onDeleteReply}
        onReplyComment={onReplyComment}
        onReopenComment={async () => {}}
        onResolveComment={async () => {}}
        onUpdateComment={async () => {}}
        onUpdateReply={onUpdateReply}
      />,
    );

    expect(screen.getByText("Existing reply.")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Reply body" }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Reply body" }), {
      target: { value: "New reply." },
    });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Reply body" }), {
      key: "Enter",
      metaKey: true,
    });

    await waitFor(() =>
      expect(onReplyComment).toHaveBeenCalledWith("comment-1", "New reply.")
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit reply" }));
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", {
        name: "Edit reply body",
      }),
    );
    fireEvent.change(
      screen.getByRole("textbox", {
        name: "Edit reply body",
      }),
      {
        target: { value: "Updated reply." },
      },
    );
    fireEvent.keyDown(
      screen.getByRole("textbox", {
        name: "Edit reply body",
      }),
      { ctrlKey: true, key: "Enter" },
    );

    await waitFor(() =>
      expect(onUpdateReply).toHaveBeenCalledWith(
        "comment-1",
        "reply-1",
        "Updated reply.",
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete reply" }));
    await waitFor(() =>
      expect(onDeleteReply).toHaveBeenCalledWith("comment-1", "reply-1")
    );
  });

  it("resolves and reopens comments", async () => {
    const onReopenComment = vi.fn(async () => {});
    const onResolveComment = vi.fn(async () => {});
    render(
      <CommentList
        comments={[
          createComment({ id: "active" }),
          createComment({ id: "resolved", resolved: true }),
        ]}
        onDeleteComment={async () => {}}
        onDeleteReply={async () => {}}
        onReplyComment={async () => {}}
        onReopenComment={onReopenComment}
        onResolveComment={onResolveComment}
        onUpdateComment={async () => {}}
        onUpdateReply={async () => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
    await waitFor(() =>
      expect(onResolveComment).toHaveBeenCalledWith("active")
    );

    fireEvent.click(screen.getByRole("button", { name: "Reopen" }));
    await waitFor(() =>
      expect(onReopenComment).toHaveBeenCalledWith("resolved")
    );
  });
});
