import { basename, resolve } from "@std/path";
import { handleCommentsRequest } from "./comments/handler.ts";
import { handlePreviewAssetRequest } from "./preview/assets.ts";
import { handlePreviewDocumentRequest } from "./preview/document.ts";
import { createHotReloadEventStream } from "./preview/events.ts";
import { renderSpaShell } from "./preview/shell.ts";
import { noStoreJson, textResponse } from "./responses.ts";

export type PreviewHandlerOptions = {
  onEventStreamClose?: () => void;
  onEventStreamOpen?: () => void;
};

const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const previewTitle = (source: string): string => {
  if (!isHttpUrl(source)) return basename(source);
  const url = new URL(source);
  const pathnameTitle = basename(decodeURIComponent(url.pathname));
  return pathnameTitle || url.hostname;
};

const eventStreamHeaders = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-store",
  "connection": "keep-alive",
};

const handleHotReloadEventRequest = (
  filePath: string,
  request: Request,
  options: PreviewHandlerOptions,
): Response =>
  new Response(
    createHotReloadEventStream(filePath, request.signal, options),
    { headers: eventStreamHeaders },
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
    { headers: eventStreamHeaders },
  );
};

export const createPreviewHandler = (
  filePath: string,
  options: PreviewHandlerOptions = {},
): Deno.ServeHandler =>
async (request) => {
  const isRemoteSource = isHttpUrl(filePath);
  const resolvedFilePath = isRemoteSource ? filePath : resolve(filePath);
  try {
    const requestUrl = new URL(request.url);
    const { pathname } = requestUrl;

    if (pathname === "/__sadoku/events") {
      if (isRemoteSource) {
        return handleRemoteEventRequest(request, options);
      }
      return handleHotReloadEventRequest(resolvedFilePath, request, options);
    }

    if (pathname === "/__sadoku/document") {
      return await handlePreviewDocumentRequest(resolvedFilePath);
    }

    if (pathname.startsWith("/__sadoku/comments")) {
      if (isRemoteSource) {
        if (pathname === "/__sadoku/comments" && request.method === "GET") {
          return noStoreJson({ comments: [], filePath: resolvedFilePath });
        }
        return textResponse(
          "Comments are only available for local files.",
          405,
        );
      }
      return await handleCommentsRequest(request, resolvedFilePath, pathname);
    }

    if (pathname.startsWith("/assets/")) {
      return await handlePreviewAssetRequest(pathname);
    }

    return new Response(renderSpaShell(previewTitle(resolvedFilePath)), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : String(error);
    return textResponse(`Failed to render Markdown: ${message}`, 500);
  }
};
