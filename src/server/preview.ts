import { basename, resolve, toFileUrl } from "@std/path";
import { formatLogMessage, logError, logInfo } from "../log.ts";
import { readPreviewAsset } from "./assets.ts";
import { handleCommentsRequest } from "./comments.ts";
import { createHotReloadEventStream } from "./events.ts";
export { formatPreviewReloadLog } from "./events.ts";

export type PreviewServerOptions = {
  file: string;
  host: string;
  keepAlive?: boolean;
  port: number;
};

export type StartedPreviewServer = {
  filePath: string;
  url: string;
  server: Deno.HttpServer<Deno.NetAddr>;
};

export type PreviewHandlerOptions = {
  onEventStreamClose?: () => void;
  onEventStreamOpen?: () => void;
};

export const formatPreviewClosedLog = (
  filePath: string,
  timestamp: Date,
): string =>
  formatLogMessage(
    `Stopping preview server after browser tab closed: ${filePath}`,
    timestamp,
  );

export const logPreviewClosed = (filePath: string): void => {
  logInfo(`Stopping preview server after browser tab closed: ${filePath}`);
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderSpaShell = (title: string): string =>
  `<!doctype html>
<html lang="und">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <div id="mdview-client-root"></div>
    <script type="module" src="/assets/client.js"></script>
  </body>
</html>`;

export const createPreviewHandler = (
  filePath: string,
  options: PreviewHandlerOptions = {},
): Deno.ServeHandler =>
async (request) => {
  const resolvedFilePath = resolve(filePath);
  try {
    const requestUrl = new URL(request.url);
    if (requestUrl.pathname === "/__mdview/events") {
      return new Response(
        createHotReloadEventStream(resolvedFilePath, request.signal, options),
        {
          headers: {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-store",
            "connection": "keep-alive",
          },
        },
      );
    }

    if (requestUrl.pathname === "/__mdview/document") {
      const markdown = await Deno.readTextFile(resolvedFilePath);
      return Response.json({
        title: basename(resolvedFilePath),
        fileUrl: toFileUrl(resolvedFilePath).href,
        markdown,
      }, {
        headers: { "cache-control": "no-store" },
      });
    }

    if (requestUrl.pathname.startsWith("/__mdview/comments")) {
      return await handleCommentsRequest(
        request,
        resolvedFilePath,
        requestUrl.pathname,
      );
    }

    if (requestUrl.pathname.startsWith("/assets/")) {
      const asset = await readPreviewAsset(requestUrl.pathname);
      if (!asset) {
        return new Response("Asset not found.", {
          status: 404,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }

      const body = asset.buffer.slice(
        asset.byteOffset,
        asset.byteOffset + asset.byteLength,
      ) as ArrayBuffer;
      return new Response(body, {
        headers: {
          "content-type": "text/javascript; charset=utf-8",
          "cache-control": requestUrl.pathname === "/assets/client.js"
            ? "no-store"
            : "public, max-age=31536000, immutable",
        },
      });
    }

    return new Response(renderSpaShell(basename(resolvedFilePath)), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : String(error);
    return new Response(`Failed to render Markdown: ${message}`, {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
};

export const startPreviewServer = async (
  options: PreviewServerOptions,
): Promise<StartedPreviewServer> => {
  const filePath = resolve(options.file);
  const fileStat = await Deno.stat(filePath).catch(() => undefined);
  if (!fileStat?.isFile) {
    throw new Error(`Markdown file not found: ${filePath}`);
  }

  let eventStreamCount = 0;
  let shutdownTimer: ReturnType<typeof setTimeout> | undefined;
  let server: Deno.HttpServer<Deno.NetAddr>;

  const scheduleShutdown = () => {
    if (eventStreamCount > 0 || shutdownTimer !== undefined) return;
    shutdownTimer = setTimeout(() => {
      shutdownTimer = undefined;
      if (eventStreamCount === 0) {
        logPreviewClosed(filePath);
        server.shutdown().catch((error) => {
          logError(
            `Failed to shut down after preview closed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        });
      }
    }, 1000);
  };

  const cancelShutdown = () => {
    if (shutdownTimer === undefined) return;
    clearTimeout(shutdownTimer);
    shutdownTimer = undefined;
  };

  server = Deno.serve(
    {
      hostname: options.host,
      port: options.port,
      onListen: () => {
        // The CLI prints the canonical URL after startPreviewServer resolves.
      },
    },
    createPreviewHandler(filePath, {
      onEventStreamOpen: () => {
        if (options.keepAlive) return;
        eventStreamCount += 1;
        cancelShutdown();
      },
      onEventStreamClose: () => {
        if (options.keepAlive) return;
        eventStreamCount = Math.max(0, eventStreamCount - 1);
        scheduleShutdown();
      },
    }),
  );

  const url = `http://${server.addr.hostname}:${server.addr.port}/`;

  server.finished.catch((error) => {
    if (!(error instanceof Deno.errors.Interrupted)) {
      logError(
        `Server stopped unexpectedly: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  });

  return { filePath, url, server };
};
