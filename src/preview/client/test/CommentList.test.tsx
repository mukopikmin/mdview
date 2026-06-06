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
  sourceHash: "example",
  sourceText: "Body",
  stale: false,
  updatedAt: "2026-06-05T00:00:00.000Z",
  ...overrides,
});

describe("CommentList", () => {
  it("groups active and stale comments", () => {
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
        ]}
        onDeleteComment={async () => {}}
        onUpdateComment={async () => {}}
      />,
    );

    expect(screen.getByRole("heading", { name: "Active comments (1)" }))
      .not.toBeNull();
    expect(screen.getByRole("heading", { name: "Stale comments (1)" }))
      .not.toBeNull();
    expect(screen.getByText("Active comment.")).not.toBeNull();
    expect(screen.getByText("Stale comment.")).not.toBeNull();
    expect(screen.getByText("Stale")).not.toBeNull();
    expect(screen.getByText("Target line")).not.toBeNull();
    expect(screen.getByText("Body")).not.toBeNull();
    expect(screen.getByText("Original line")).not.toBeNull();
    expect(screen.getByText("Old body")).not.toBeNull();
  });

  it("updates and deletes comments", async () => {
    const onDeleteComment = vi.fn(async () => {});
    const onUpdateComment = vi.fn(async () => {});
    render(
      <CommentList
        comments={[createComment({ body: "Original body." })]}
        onDeleteComment={onDeleteComment}
        onUpdateComment={onUpdateComment}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Updated body." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
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
});
