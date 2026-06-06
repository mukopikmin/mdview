import { useEffect, useState } from "react";
import {
  createComment,
  deleteComment,
  loadComments,
  type PreviewComment,
  updateComment,
} from "./comments";
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

const loadPreviewDocument = async (): Promise<PreviewDocument> => {
  const response = await fetch("/__mdview/document");
  if (!response.ok) {
    throw new Error(`Failed to load Markdown: ${response.status}`);
  }
  return await response.json() as PreviewDocument;
};

export const App = () => {
  const [state, setState] = useState<LoadState>({ status: "loading" });

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

  return (
    <>
      <style>{previewThemeCss}</style>
      <main>
        <header>
          Previewing{" "}
          <a href={state.document.fileUrl}>{state.document.title}</a>. Refresh
          to reload changes.
        </header>
        <MarkdownPreview
          comments={state.comments}
          markdown={state.document.markdown}
          onCreateComment={handleCreateComment}
          onDeleteComment={handleDeleteComment}
          onUpdateComment={handleUpdateComment}
        />
      </main>
    </>
  );
};
