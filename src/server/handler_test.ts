import { assertEquals, assertMatch } from "@std/assert";

import { getCommentsFilePath } from "./comments/storage.ts";
import { createPreviewHandler } from "./handler.ts";
import {
  createTempMarkdown,
  removeTempMarkdown,
  serveHandlerInfo,
  withTempCommentsDirectory,
} from "./test_helpers.ts";

const requestHandler = async (
  handler: Deno.ServeHandler,
  pathname: string,
): Promise<Response> =>
  await handler(
    new Request(`http://127.0.0.1:3334${pathname}`),
    serveHandlerInfo,
  );

Deno.test("converts handler failures to plain text server errors", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await createTempMarkdown();
    await Deno.writeTextFile(getCommentsFilePath(filePath), "{");
    try {
      const response = await requestHandler(
        createPreviewHandler(filePath),
        "/__mdview/comments",
      );

      assertEquals(response.status, 500);
      assertEquals(
        response.headers.get("content-type"),
        "text/plain; charset=utf-8",
      );
      assertMatch(await response.text(), /^Failed to render Markdown:/);
    } finally {
      await removeTempMarkdown(filePath);
    }
  });
});

Deno.test("returns a server error when the Markdown document disappears", async () => {
  const filePath = await createTempMarkdown();
  const handler = createPreviewHandler(filePath);
  await Deno.remove(filePath);
  try {
    const response = await requestHandler(handler, "/__mdview/document");

    assertEquals(response.status, 500);
    assertMatch(await response.text(), /^Failed to render Markdown:/);
  } finally {
    await removeTempMarkdown(filePath);
  }
});
