import { assertEquals } from "@std/assert";

import {
  createPreviewHandler,
  formatPreviewReloadLog,
} from "../../src/server/preview.ts";

Deno.test("formats server-side hot reload log messages", () => {
  assertEquals(
    formatPreviewReloadLog(
      "/tmp/example.md",
      new Date("2026-06-01T07:55:00.000Z"),
    ),
    "[2026-06-01T07:55:00.000Z] Reloading preview after Markdown change: /tmp/example.md",
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
