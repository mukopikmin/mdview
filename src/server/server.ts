import { resolve } from "@std/path";
import { formatLogMessage, logError, logInfo } from "../log.ts";
import { createPreviewHandler } from "./handler.ts";

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

  const server = Deno.serve(
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
