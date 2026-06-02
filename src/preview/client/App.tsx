import { useEffect, useState } from "react";
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
  | { document: PreviewDocument; status: "loaded" }
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
    loadPreviewDocument()
      .then((document) => {
        if (cancelled) return;
        globalThis.document.title = document.title;
        setState({
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
        <MarkdownPreview markdown={state.document.markdown} />
      </main>
    </>
  );
};
