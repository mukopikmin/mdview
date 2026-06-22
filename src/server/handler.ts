import { basename, resolve } from "@std/path";
import { handleCommentsRequest } from "./comments/handler.ts";
import { handlePreviewAssetRequest } from "./preview/assets.ts";
import { handlePreviewDocumentRequest } from "./preview/document.ts";
import { createHotReloadEventStream } from "./preview/events.ts";
import { renderSpaShell } from "./preview/shell.ts";
import { textResponse } from "./responses.ts";

export type PreviewHandlerOptions = {
  onEventStreamClose?: () => void;
  onEventStreamOpen?: () => void;
};

const handleHotReloadEventRequest = (
  filePath: string,
  request: Request,
  options: PreviewHandlerOptions,
): Response =>
  new Response(
    createHotReloadEventStream(filePath, request.signal, options),
    {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store",
        "connection": "keep-alive",
      },
    },
  );

export const createPreviewHandler = (
  filePath: string,
  options: PreviewHandlerOptions = {},
): Deno.ServeHandler =>
async (request) => {
  const resolvedFilePath = resolve(filePath);
  try {
    const requestUrl = new URL(request.url);
    const { pathname } = requestUrl;

    if (pathname === "/__sadoku/events") {
      return handleHotReloadEventRequest(resolvedFilePath, request, options);
    }

    if (pathname === "/__sadoku/document") {
      return await handlePreviewDocumentRequest(resolvedFilePath);
    }

    if (pathname.startsWith("/__sadoku/comments")) {
      return await handleCommentsRequest(request, resolvedFilePath, pathname);
    }

    if (pathname.startsWith("/assets/")) {
      return await handlePreviewAssetRequest(pathname);
    }

    return new Response(renderSpaShell(basename(resolvedFilePath)), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : String(error);
    return textResponse(`Failed to render Markdown: ${message}`, 500);
  }
};
