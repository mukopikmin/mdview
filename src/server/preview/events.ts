import { dirname, resolve } from "@std/path";
import { formatLogMessage } from "../../log.ts";

type EventStreamOptions = {
  onEventStreamClose?: () => void;
  onEventStreamOpen?: () => void;
};

const reloadEvent = new TextEncoder().encode("event: reload\ndata: {}\n\n");

export const formatPreviewReloadLog = (
  filePath: string,
  timestamp: Date,
): string =>
  formatLogMessage(
    `Reloading preview after Markdown change: ${filePath}`,
    timestamp,
  );

export const logPreviewReload = (filePath: string): void => {
  console.log(formatPreviewReloadLog(filePath, new Date()));
};

export const createHotReloadEventStream = (
  filePath: string,
  signal: AbortSignal,
  options: EventStreamOptions = {},
): ReadableStream<Uint8Array> => {
  let watcher: Deno.FsWatcher | undefined;
  let close: (() => void) | undefined;
  let closed = false;

  const closeOnce = (controller?: ReadableStreamDefaultController) => {
    if (closed) return;
    closed = true;
    watcher?.close();
    options.onEventStreamClose?.();
    if (!controller) return;
    try {
      controller.close();
    } catch {
      // The stream may already be closed if the client disconnected.
    }
  };

  return new ReadableStream({
    start(controller) {
      options.onEventStreamOpen?.();
      watcher = Deno.watchFs(dirname(filePath));

      close = () => closeOnce(controller);
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

            logPreviewReload(filePath);
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
      closeOnce();
    },
  });
};
