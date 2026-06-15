import { assertEquals } from "@std/assert";

import { formatLogMessage } from "./log.ts";

Deno.test("formats log messages with ISO timestamps", () => {
  assertEquals(
    formatLogMessage(
      "Preview: http://127.0.0.1:8000/",
      new Date("2026-06-01T08:00:00.000Z"),
    ),
    "[2026-06-01T08:00:00.000Z] Preview: http://127.0.0.1:8000/",
  );
});
