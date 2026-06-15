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
