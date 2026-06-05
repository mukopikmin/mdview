import { assertEquals } from "@std/assert";

import {
  createPreviewHandler,
  formatPreviewClosedLog,
  formatPreviewReloadLog,
} from "../../src/server/preview.ts";

Deno.test("serves hot reload events as an SSE stream", async () => {
  const filePath = "test/e2e/fixtures/comprehensive.md";
  const response = await createPreviewHandler(filePath)(
    new Request("http://127.0.0.1:3334/__mdview/events"),
    {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
  );

  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("content-type"),
    "text/event-stream; charset=utf-8",
  );
  assertEquals(response.headers.get("cache-control"), "no-store");
  assertEquals(response.headers.get("connection"), "keep-alive");

  await response.body?.cancel();
});

Deno.test("serves the preview client asset", async () => {
  const filePath = "test/e2e/fixtures/comprehensive.md";
  const response = await createPreviewHandler(filePath)(
    new Request("http://127.0.0.1:3334/assets/client.js"),
    {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
  );

  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("content-type"),
    "text/javascript; charset=utf-8",
  );
  assertEquals(response.headers.get("cache-control"), "no-store");
  const script = await response.text();
  assertEquals(script.includes("/__mdview/events"), true);
  assertEquals(script.includes("process.env"), false);
});

Deno.test("serves the SPA shell", async () => {
  const filePath = "test/e2e/fixtures/comprehensive.md";
  const response = await createPreviewHandler(filePath)(
    new Request("http://127.0.0.1:3334/"),
    {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
  );

  const html = await response.text();

  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("content-type"),
    "text/html; charset=utf-8",
  );
  assertEquals(html.includes('<div id="mdview-client-root"></div>'), true);
  assertEquals(html.includes('src="/assets/client.js"'), true);
});

Deno.test("serves the raw preview document for the SPA", async () => {
  const filePath = "test/e2e/fixtures/comprehensive.md";
  const response = await createPreviewHandler(filePath)(
    new Request("http://127.0.0.1:3334/__mdview/document"),
    {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
  );

  const document = await response.json();

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("cache-control"), "no-store");
  assertEquals(document.title, "comprehensive.md");
  assertEquals(document.fileUrl.endsWith("/comprehensive.md"), true);
  assertEquals(document.markdown.includes("# Comprehensive Document"), true);
});

Deno.test("stores preview comments next to the Markdown file", async () => {
  const filePath = await Deno.makeTempFile({
    prefix: "mdview-",
    suffix: ".md",
  });
  await Deno.writeTextFile(filePath, "# Title\n\nBody\n");
  try {
    const handler = createPreviewHandler(filePath);

    const emptyResponse = await handler(
      new Request("http://127.0.0.1:3334/__mdview/comments"),
      {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
    );
    const emptyDocument = await emptyResponse.json();
    assertEquals(emptyResponse.status, 200);
    assertEquals(emptyDocument.filePath, filePath);
    assertEquals(emptyDocument.comments, []);

    const createResponse = await handler(
      new Request("http://127.0.0.1:3334/__mdview/comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ line: 3, body: "Clarify this." }),
      }),
      {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
    );
    const createdComment = await createResponse.json();
    assertEquals(createResponse.status, 200);
    assertEquals(createdComment.line, 3);
    assertEquals(createdComment.body, "Clarify this.");

    const updateResponse = await handler(
      new Request(
        `http://127.0.0.1:3334/__mdview/comments/${createdComment.id}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ body: "Clarify this paragraph." }),
        },
      ),
      {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
    );
    const updatedComment = await updateResponse.json();
    assertEquals(updateResponse.status, 200);
    assertEquals(updatedComment.body, "Clarify this paragraph.");

    const deleteResponse = await handler(
      new Request(
        `http://127.0.0.1:3334/__mdview/comments/${createdComment.id}`,
        { method: "DELETE" },
      ),
      {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
    );
    assertEquals(deleteResponse.status, 204);

    const storedText = await Deno.readTextFile(
      `${filePath}.mdview-comments.json`,
    );
    const storedDocument = JSON.parse(storedText);
    assertEquals(storedDocument.comments, []);
  } finally {
    await Deno.remove(filePath).catch(() => {});
    await Deno.remove(`${filePath}.mdview-comments.json`).catch(() => {});
  }
});

Deno.test("formats server-side hot reload log messages", () => {
  assertEquals(
    formatPreviewReloadLog(
      "/tmp/example.md",
      new Date("2026-06-01T07:55:00.000Z"),
    ),
    "[2026-06-01T07:55:00.000Z] Reloading preview after Markdown change: /tmp/example.md",
  );
});

Deno.test("formats preview closed log messages", () => {
  assertEquals(
    formatPreviewClosedLog(
      "/tmp/example.md",
      new Date("2026-06-01T07:56:00.000Z"),
    ),
    "[2026-06-01T07:56:00.000Z] Stopping preview server after browser tab closed: /tmp/example.md",
  );
});

Deno.test("reports hot reload stream open and close", async () => {
  const filePath = "test/e2e/fixtures/comprehensive.md";
  let opened = 0;
  let closed = 0;

  const response = await createPreviewHandler(filePath, {
    onEventStreamOpen: () => {
      opened += 1;
    },
    onEventStreamClose: () => {
      closed += 1;
    },
  })(
    new Request("http://127.0.0.1:3334/__mdview/events"),
    {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
  );

  assertEquals(opened, 1);
  assertEquals(closed, 0);

  await response.body?.cancel();

  assertEquals(opened, 1);
  assertEquals(closed, 1);
});
