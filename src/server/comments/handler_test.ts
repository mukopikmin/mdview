import { assertEquals, assertMatch } from "@std/assert";

import { createPreviewHandler } from "../mod.ts";
import {
  createTempMarkdown,
  removeTempMarkdown,
  serveHandlerInfo,
} from "../test_helpers.ts";

const requestComments = async (
  handler: Deno.ServeHandler,
  pathname: string,
  init?: RequestInit,
): Promise<Response> =>
  await handler(
    new Request(`http://127.0.0.1:3334${pathname}`, init),
    serveHandlerInfo,
  );

Deno.test("validates comment creation input", async () => {
  const filePath = await createTempMarkdown();
  const handler = createPreviewHandler(filePath);
  const cases: Array<{
    body: BodyInit | null;
    expected: string;
  }> = [
    { body: "{", expected: "Invalid JSON body." },
    { body: JSON.stringify(null), expected: "Comment line is required." },
    {
      body: JSON.stringify({ body: "text" }),
      expected: "Comment line must be a positive integer.",
    },
    {
      body: JSON.stringify({ line: 0, body: "text" }),
      expected: "Comment line must be a positive integer.",
    },
    {
      body: JSON.stringify({ line: 1.5, body: "text" }),
      expected: "Comment line must be a positive integer.",
    },
    {
      body: JSON.stringify({ line: 1, body: " " }),
      expected: "Comment body is required.",
    },
    {
      body: JSON.stringify({ line: 99, body: "text" }),
      expected: "Comment line does not exist.",
    },
  ];

  try {
    for (const testCase of cases) {
      const response = await requestComments(
        handler,
        "/__mdview/comments",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: testCase.body,
        },
      );

      assertEquals(response.status, 400);
      assertEquals(
        response.headers.get("content-type"),
        "text/plain; charset=utf-8",
      );
      assertEquals(await response.text(), testCase.expected);
    }
  } finally {
    await removeTempMarkdown(filePath);
  }
});

Deno.test("trims comment bodies before storing them", async () => {
  const filePath = await createTempMarkdown();
  const handler = createPreviewHandler(filePath);
  try {
    const response = await requestComments(
      handler,
      "/__mdview/comments",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ line: 3, body: "  Review this.  " }),
      },
    );
    const comment = await response.json();

    assertEquals(response.status, 200);
    assertEquals(response.headers.get("cache-control"), "no-store");
    assertEquals(comment.body, "Review this.");
    assertMatch(comment.id, /^[0-9a-f-]{36}$/);
    assertEquals(comment.createdAt, comment.updatedAt);
  } finally {
    await removeTempMarkdown(filePath);
  }
});

Deno.test("returns not found for missing comments and unknown actions", async () => {
  const filePath = await createTempMarkdown();
  const handler = createPreviewHandler(filePath);
  try {
    const cases: Array<[string, string, string]> = [
      ["PUT", "/__mdview/comments/missing", "Comment not found."],
      ["DELETE", "/__mdview/comments/missing", "Comment not found."],
      ["POST", "/__mdview/comments/missing/resolve", "Comment not found."],
      ["POST", "/__mdview/comments/missing/reopen", "Comment not found."],
      ["POST", "/__mdview/comments/missing/unknown", "Not found."],
      ["GET", "/__mdview/comments/", "Comment not found."],
    ];

    for (const [method, pathname, expected] of cases) {
      const response = await requestComments(handler, pathname, {
        method,
        headers: { "content-type": "application/json" },
        body: method === "PUT"
          ? JSON.stringify({ body: "Updated" })
          : undefined,
      });

      assertEquals(response.status, 404);
      assertEquals(await response.text(), expected);
    }
  } finally {
    await removeTempMarkdown(filePath);
  }
});

Deno.test("returns method not allowed for unsupported comment methods", async () => {
  const filePath = await createTempMarkdown();
  const handler = createPreviewHandler(filePath);
  try {
    const response = await requestComments(
      handler,
      "/__mdview/comments/comment-1",
      { method: "PATCH" },
    );

    assertEquals(response.status, 405);
    assertEquals(await response.text(), "Method not allowed.");
  } finally {
    await removeTempMarkdown(filePath);
  }
});

Deno.test("accepts URL-encoded comment identifiers", async () => {
  const filePath = await createTempMarkdown();
  const commentsPath = `${filePath}.mdview-comments.json`;
  await Deno.writeTextFile(
    commentsPath,
    JSON.stringify({
      comments: [{
        body: "Original",
        createdAt: "2026-06-07T00:00:00.000Z",
        id: "comment with spaces",
        line: 3,
        originalLine: 3,
        resolved: false,
        sourceText: "Body",
        stale: false,
        updatedAt: "2026-06-07T00:00:00.000Z",
      }],
      filePath,
    }),
  );

  try {
    const response = await requestComments(
      createPreviewHandler(filePath),
      "/__mdview/comments/comment%20with%20spaces",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: "Updated" }),
      },
    );

    assertEquals(response.status, 200);
    assertEquals((await response.json()).body, "Updated");
  } finally {
    await removeTempMarkdown(filePath);
  }
});
