import { assertEquals } from "@std/assert";

import { createPreviewHandler } from "../../src/server/mod.ts";

Deno.test("serves hot reload events as an SSE stream", async () => {
  const filePath = "test/integration/fixtures/comprehensive.md";
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
  const filePath = "test/integration/fixtures/comprehensive.md";
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
  const filePath = "test/integration/fixtures/comprehensive.md";
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
  const filePath = "test/integration/fixtures/comprehensive.md";
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
