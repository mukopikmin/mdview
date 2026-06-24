import { handleCommentsRequest } from "./comments/handler.ts";
import { handlePreviewAssetRequest } from "./preview/assets.ts";
import { handlePreviewDocumentRequest } from "./preview/document.ts";
import { createHotReloadEventStream } from "./preview/events.ts";
import { renderSpaShell } from "./preview/shell.ts";
import { textResponse } from "./responses.ts";
import {
  createPreviewSource,
  type PreviewSource,
  sourceTitle,
} from "./source.ts";

export type PreviewHandlerOptions = {
  onEventStreamClose?: () => void;
  onEventStreamOpen?: () => void;
};

const handleHotReloadEventRequest = (
  documentSource: string,
  request: Request,
  options: PreviewHandlerOptions,
): Response =>
  new Response(
    createHotReloadEventStream(documentSource, request.signal, options),
    {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store",
        "connection": "keep-alive",
      },
    },
  );

const handleRemoteEventRequest = (
  request: Request,
  options: PreviewHandlerOptions,
): Response => {
  let close: (() => void) | undefined;
  return new Response(
    new ReadableStream({
      start() {
        options.onEventStreamOpen?.();
        close = () => options.onEventStreamClose?.();
        request.signal.addEventListener("abort", close, { once: true });
      },
      cancel() {
        if (close) {
          request.signal.removeEventListener("abort", close);
          close();
          close = undefined;
        }
      },
    }),
    {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store",
        "connection": "keep-alive",
      },
    },
  );
};

export const createPreviewHandler = (
  input: string | PreviewSource,
  options: PreviewHandlerOptions = {},
): Deno.ServeHandler =>
async (request) => {
  const previewSource = typeof input === "string"
    ? createPreviewSource(input)
    : input;
  try {
    const requestUrl = new URL(request.url);
    const { pathname } = requestUrl;

    if (pathname === "/__sadoku/events") {
      if (previewSource.isRemote) {
        return handleRemoteEventRequest(request, options);
      }
      return handleHotReloadEventRequest(
        previewSource.documentSource,
        request,
        options,
      );
    }

    if (pathname === "/__sadoku/document") {
      return await handlePreviewDocumentRequest(previewSource.documentSource);
    }

    if (pathname.startsWith("/__sadoku/comments")) {
      return await handleCommentsRequest(request, previewSource, pathname);
    }

    if (pathname.startsWith("/assets/")) {
      return await handlePreviewAssetRequest(pathname);
    }

    return new Response(
      renderSpaShell(sourceTitle(previewSource.documentSource)),
      {
        headers: { "content-type": "text/html; charset=utf-8" },
      },
    );
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : String(error);
    return textResponse(`Failed to render Markdown: ${message}`, 500);
  }
};
