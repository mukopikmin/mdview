import { useEffect, useState } from "react";
import {
  createComment,
  createReply,
  deleteComment,
  loadComments,
  type PreviewComment,
  reopenComment,
  resolveComment,
  updateComment,
} from "./comments";
import { CommentList } from "./CommentList";
import { connectHotReload } from "./hot_reload";
import { MarkdownPreview } from "./MarkdownPreview";
import { initializeMermaid } from "./mermaid";
import { previewThemeCss } from "./theme";

type PreviewDocument = {
  fileUrl: string;
  markdown: string;
  title: string;
};

type LoadState =
  | { status: "loading" }
  | {
    comments: PreviewComment[];
    document: PreviewDocument;
    status: "loaded";
  }
  | { message: string; status: "error" };

type View = "comments" | "preview";

const loadPreviewDocument = async (): Promise<PreviewDocument> => {
  const response = await fetch("/__mdview/document");
  if (!response.ok) {
    throw new Error(`Failed to load Markdown: ${response.status}`);
  }
  return await response.json() as PreviewDocument;
};

export const App = () => {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [view, setView] = useState<View>("preview");

  useEffect(() => {
    return connectHotReload();
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadPreviewDocument(), loadComments()])
      .then(([document, commentsDocument]) => {
        if (cancelled) return;
        globalThis.document.title = document.title;
        setState({
          comments: commentsDocument.comments,
          document,
          status: "loaded",
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          message: error instanceof Error ? error.message : String(error),
          status: "error",
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state.status !== "loaded") return;
    initializeMermaid();
  }, [state]);

  const handleCreateComment = async (
    line: number,
    body: string,
  ): Promise<void> => {
    const comment = await createComment(line, body);
    setState((current) => {
      if (current.status !== "loaded") return current;
      return {
        ...current,
        comments: [...current.comments, comment],
      };
    });
  };

  const handleUpdateComment = async (
    id: string,
    body: string,
  ): Promise<void> => {
    const comment = await updateComment(id, body);
    setState((current) => {
      if (current.status !== "loaded") return current;
      return {
        ...current,
        comments: current.comments.map((existing) =>
          existing.id === comment.id ? comment : existing
        ),
      };
    });
  };

  const handleReplyComment = async (
    id: string,
    body: string,
  ): Promise<void> => {
    const comment = await createReply(id, body);
    setState((current) => {
      if (current.status !== "loaded") return current;
      return {
        ...current,
        comments: current.comments.map((existing) =>
          existing.id === comment.id ? comment : existing
        ),
      };
    });
  };

  const handleDeleteComment = async (id: string): Promise<void> => {
    await deleteComment(id);
    setState((current) => {
      if (current.status !== "loaded") return current;
      return {
        ...current,
        comments: current.comments.filter((comment) => comment.id !== id),
      };
    });
  };

  const handleResolveComment = async (id: string): Promise<void> => {
    const comment = await resolveComment(id);
    setState((current) => {
      if (current.status !== "loaded") return current;
      return {
        ...current,
        comments: current.comments.map((existing) =>
          existing.id === comment.id ? comment : existing
        ),
      };
    });
  };

  const handleReopenComment = async (id: string): Promise<void> => {
    const comment = await reopenComment(id);
    setState((current) => {
      if (current.status !== "loaded") return current;
      return {
        ...current,
        comments: current.comments.map((existing) =>
          existing.id === comment.id ? comment : existing
        ),
      };
    });
  };

  if (state.status === "loading") {
    return (
      <>
        <style>{previewThemeCss}</style>
        <main>
          <header>Loading preview...</header>
        </main>
      </>
    );
  }

  if (state.status === "error") {
    return (
      <>
        <style>{previewThemeCss}</style>
        <main>
          <header>{state.message}</header>
        </main>
      </>
    );
  }

  const activeComments = state.comments.filter((comment) =>
    !comment.resolved && !comment.stale
  );
  const staleCommentCount =
    state.comments.filter((comment) => !comment.resolved && comment.stale)
      .length;

  return (
    <>
      <style>{previewThemeCss}</style>
      <main>
        <header>
          <div>
            Previewing{" "}
            <a href={state.document.fileUrl}>{state.document.title}</a>. Refresh
            to reload changes.
          </div>
          <nav className="preview-nav" aria-label="Preview views">
            <button
              aria-current={view === "preview" ? "page" : undefined}
              onClick={() => setView("preview")}
              type="button"
            >
              Preview
            </button>
            <button
              aria-current={view === "comments" ? "page" : undefined}
              onClick={() => setView("comments")}
              type="button"
            >
              Comments {state.comments.length}
              {staleCommentCount > 0 && <span>Stale {staleCommentCount}</span>}
            </button>
          </nav>
        </header>
        {view === "preview"
          ? (
            <MarkdownPreview
              comments={activeComments}
              markdown={state.document.markdown}
              onCreateComment={handleCreateComment}
              onDeleteComment={handleDeleteComment}
              onReplyComment={handleReplyComment}
              onResolveComment={handleResolveComment}
              onUpdateComment={handleUpdateComment}
            />
          )
          : (
            <CommentList
              comments={state.comments}
              onDeleteComment={handleDeleteComment}
              onReplyComment={handleReplyComment}
              onReopenComment={handleReopenComment}
              onResolveComment={handleResolveComment}
              onUpdateComment={handleUpdateComment}
            />
          )}
      </main>
    </>
  );
};
