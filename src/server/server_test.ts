import { assertEquals, assertRejects } from "@std/assert";

import {
  createPreviewShutdownScheduler,
  type StartedPreviewServer,
  startPreviewServer,
} from "./server.ts";
import { createTempMarkdown, removeTempMarkdown } from "./test_helpers.ts";

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const stopServer = async (preview: StartedPreviewServer): Promise<void> => {
  await preview.server.shutdown().catch(() => {});
  await preview.server.finished.catch(() => {});
};

Deno.test("rejects missing files and directories", async () => {
  const directory = await Deno.makeTempDir({ prefix: "sadoku-server-" });
  try {
    await assertRejects(
      () =>
        startPreviewServer({
          file: `${directory}/missing.md`,
          host: "127.0.0.1",
          port: 0,
        }),
      Error,
      "Markdown file not found:",
    );
    await assertRejects(
      () =>
        startPreviewServer({
          file: directory,
          host: "127.0.0.1",
          port: 0,
        }),
      Error,
      "Markdown file not found:",
    );
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("starts on an ephemeral port and serves the preview document", async () => {
  const filePath = await createTempMarkdown("# Server test\n");
  const preview = await startPreviewServer({
    file: filePath,
    host: "127.0.0.1",
    keepAlive: true,
    port: 0,
  });

  try {
    assertEquals(preview.filePath, filePath);
    assertEquals(preview.url.startsWith("http://127.0.0.1:"), true);

    const response = await fetch(new URL("/__sadoku/document", preview.url));
    const document = await response.json();
    assertEquals(response.status, 200);
    assertEquals(document.markdown, "# Server test\n");
  } finally {
    await stopServer(preview);
    await removeTempMarkdown(filePath);
  }
});

Deno.test("increments the port when the requested port is in use", async () => {
  const filePath = await createTempMarkdown("# Port fallback test\n");
  let occupiedPort: number;
  let occupiedListener: Deno.TcpListener;

  while (true) {
    occupiedListener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
    occupiedPort = occupiedListener.addr.port;
    if (occupiedPort < 65535) {
      try {
        const nextPort = Deno.listen({
          hostname: "127.0.0.1",
          port: occupiedPort + 1,
        });
        nextPort.close();
        break;
      } catch (error) {
        occupiedListener.close();
        if (error instanceof Deno.errors.AddrInUse) continue;
        throw error;
      }
    }
    occupiedListener.close();
  }

  let preview: StartedPreviewServer | undefined;
  try {
    preview = await startPreviewServer({
      file: filePath,
      host: "127.0.0.1",
      keepAlive: true,
      port: occupiedPort,
    });

    assertEquals(preview.server.addr.port, occupiedPort + 1);
    assertEquals(preview.url, `http://127.0.0.1:${occupiedPort + 1}/`);
  } finally {
    occupiedListener.close();
    if (preview) await stopServer(preview);
    await removeTempMarkdown(filePath);
  }
});

Deno.test("shuts down only after the last event stream closes", async () => {
  let shutdowns = 0;
  const scheduler = createPreviewShutdownScheduler({
    delayMs: 20,
    filePath: "/tmp/example.md",
    shutdown: () => {
      shutdowns += 1;
      return Promise.resolve();
    },
  });

  scheduler.onEventStreamOpen();
  scheduler.onEventStreamOpen();
  scheduler.onEventStreamClose();
  await wait(40);
  assertEquals(shutdowns, 0);

  scheduler.onEventStreamClose();
  await wait(40);
  assertEquals(shutdowns, 1);
});

Deno.test("cancels pending shutdown when an event stream reconnects", async () => {
  let shutdowns = 0;
  const scheduler = createPreviewShutdownScheduler({
    delayMs: 30,
    filePath: "/tmp/example.md",
    shutdown: () => {
      shutdowns += 1;
      return Promise.resolve();
    },
  });

  scheduler.onEventStreamOpen();
  scheduler.onEventStreamClose();
  await wait(10);
  scheduler.onEventStreamOpen();
  await wait(40);
  assertEquals(shutdowns, 0);

  scheduler.onEventStreamClose();
  await wait(50);
  assertEquals(shutdowns, 1);
});

Deno.test("does not schedule shutdown when keepAlive is enabled", async () => {
  let shutdowns = 0;
  const scheduler = createPreviewShutdownScheduler({
    delayMs: 10,
    filePath: "/tmp/example.md",
    keepAlive: true,
    shutdown: () => {
      shutdowns += 1;
      return Promise.resolve();
    },
  });

  scheduler.onEventStreamOpen();
  scheduler.onEventStreamClose();
  await wait(30);

  assertEquals(shutdowns, 0);
});

Deno.test("starts the preview server for a URL source", async () => {
  const source = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen: () => {} },
    () => new Response("# Remote server test\n"),
  );
  const sourceUrl = `http://127.0.0.1:${source.addr.port}/remote.md?token=a`;
  const preview = await startPreviewServer({
    file: sourceUrl,
    host: "127.0.0.1",
    keepAlive: true,
    port: 0,
  });

  try {
    assertEquals(preview.filePath, sourceUrl);
    const response = await fetch(new URL("/__sadoku/document", preview.url));
    const document = await response.json();

    assertEquals(response.status, 200);
    assertEquals(document.fileUrl, sourceUrl);
    assertEquals(document.markdown, "# Remote server test\n");
  } finally {
    await stopServer(preview);
    await source.shutdown().catch(() => {});
    await source.finished.catch(() => {});
  }
});
