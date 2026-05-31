import { basename, dirname, resolve, toFileUrl } from "@std/path";
import { escapeHtml, renderMarkdown } from "../markdown/html.ts";
import { readMermaidAsset } from "./assets.ts";
import { renderPreviewPage } from "./page.ts";

export type PreviewServerOptions = {
  file: string;
  host: string;
  port: number;
};

export type StartedPreviewServer = {
  filePath: string;
  url: string;
  server: Deno.HttpServer<Deno.NetAddr>;
};

const reloadEvent = new TextEncoder().encode("event: reload\ndata: {}\n\n");

export const createHotReloadEventStream = (
  filePath: string,
  signal: AbortSignal,
): ReadableStream<Uint8Array> => {
  let watcher: Deno.FsWatcher | undefined;
  let close: (() => void) | undefined;

  return new ReadableStream({
    start(controller) {
      watcher = Deno.watchFs(dirname(filePath));

      close = () => {
        watcher?.close();
        try {
          controller.close();
        } catch {
          // The stream may already be closed if the client disconnected.
        }
      };
      signal.addEventListener("abort", close, { once: true });

      (async () => {
        try {
          for await (const event of watcher) {
            if (
              event.kind === "access" ||
              !event.paths.some((path) => resolve(path) === filePath)
            ) {
              continue;
            }

            controller.enqueue(reloadEvent);
          }
        } catch (error) {
          if (!signal.aborted) {
            controller.error(error);
          }
        } finally {
          if (close) {
            signal.removeEventListener("abort", close);
          }
        }
      })();
    },
    cancel() {
      close?.();
    },
  });
};

export const createPreviewHandler =
  (filePath: string): Deno.ServeHandler => async (request) => {
    try {
      const requestUrl = new URL(request.url);
      if (requestUrl.pathname === "/__mdview/events") {
        return new Response(
          createHotReloadEventStream(filePath, request.signal),
          {
            headers: {
              "content-type": "text/event-stream; charset=utf-8",
              "cache-control": "no-store",
              "connection": "keep-alive",
            },
          },
        );
      }

      if (requestUrl.pathname.startsWith("/assets/")) {
        const asset = await readMermaidAsset(requestUrl.pathname);
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
            "cache-control": "public, max-age=31536000, immutable",
          },
        });
      }

      const markdown = await Deno.readTextFile(filePath);
      const title = escapeHtml(basename(filePath));
      const html = renderPreviewPage({
        title,
        fileUrl: toFileUrl(filePath).href,
        body: renderMarkdown(markdown),
      });

      return new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    } catch (error) {
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

  const server = Deno.serve({
    hostname: options.host,
    port: options.port,
    onListen: () => {
      // The CLI prints the canonical URL after startPreviewServer resolves.
    },
  }, createPreviewHandler(filePath));

  const url = `http://${server.addr.hostname}:${server.addr.port}/`;

  server.finished.catch((error) => {
    if (!(error instanceof Deno.errors.Interrupted)) {
      console.error(
        `Server stopped unexpectedly: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  });

  return { filePath, url, server };
};
