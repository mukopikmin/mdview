import { assertEquals } from "@std/assert";

import { handlePreviewDocumentRequest } from "./document.ts";
import { createTempMarkdown, removeTempMarkdown } from "../test_helpers.ts";

Deno.test("returns the current Markdown document without caching", async () => {
  const filePath = await createTempMarkdown("first");
  try {
    const first = await handlePreviewDocumentRequest(filePath);
    await Deno.writeTextFile(filePath, "second");
    const second = await handlePreviewDocumentRequest(filePath);

    assertEquals(first.headers.get("cache-control"), "no-store");
    assertEquals((await first.json()).markdown, "first");
    assertEquals((await second.json()).markdown, "second");
  } finally {
    await removeTempMarkdown(filePath);
  }
});

Deno.test("returns Markdown documents from URLs", async () => {
  const server = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen: () => {} },
    (request) => {
      const url = new URL(request.url);
      return new Response(`# Remote ${url.searchParams.get("token")}\n`);
    },
  );

  try {
    const url = `http://127.0.0.1:${server.addr.port}/docs/readme.md?token=a`;
    const response = await handlePreviewDocumentRequest(url);
    const document = await response.json();

    assertEquals(response.headers.get("cache-control"), "no-store");
    assertEquals(document.title, "readme.md");
    assertEquals(document.fileUrl, url);
    assertEquals(document.markdown, "# Remote a\n");
  } finally {
    await server.shutdown().catch(() => {});
    await server.finished.catch(() => {});
  }
});
