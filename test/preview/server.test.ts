import { assertEquals } from "@std/assert";

import { formatPreviewClosedLog } from "../../src/server/preview.ts";

Deno.test("formats preview closed log messages", () => {
  assertEquals(
    formatPreviewClosedLog(
      "/tmp/example.md",
      new Date("2026-06-01T07:56:00.000Z"),
    ),
    "[2026-06-01T07:56:00.000Z] Stopping preview server after browser tab closed: /tmp/example.md",
  );
});
