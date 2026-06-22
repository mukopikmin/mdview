import { assertEquals, assertMatch } from "@std/assert";
import { dirname } from "@std/path";

import { getCommentsFilePath } from "./storage.ts";
import { createPreviewHandler } from "../mod.ts";
import {
  createTempMarkdown,
  removeTempMarkdown,
  serveHandlerInfo,
  withTempCommentsDirectory,
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

const testWithTempComments = (
  name: string,
  fn: () => Promise<void>,
): void => {
  Deno.test(name, async () => {
    await withTempCommentsDirectory(fn);
  });
};

testWithTempComments("validates comment creation input", async () => {
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
        "/__sadoku/comments",
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

testWithTempComments("trims comment bodies before storing them", async () => {
  const filePath = await createTempMarkdown();
  const handler = createPreviewHandler(filePath);
  try {
    const response = await requestComments(
      handler,
      "/__sadoku/comments",
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

testWithTempComments("adds replies to comments", async () => {
  const filePath = await createTempMarkdown();
  const handler = createPreviewHandler(filePath);
  try {
    const createResponse = await requestComments(
      handler,
      "/__sadoku/comments",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ line: 3, body: "Question" }),
      },
    );
    const createdComment = await createResponse.json();

    const replyResponse = await requestComments(
      handler,
      `/__sadoku/comments/${createdComment.id}/replies`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: "  More context.  " }),
      },
    );
    const updatedComment = await replyResponse.json();

    assertEquals(replyResponse.status, 200);
    assertEquals(updatedComment.replies.length, 1);
    assertEquals(updatedComment.replies[0].body, "More context.");
    assertMatch(updatedComment.replies[0].id, /^[0-9a-f-]{36}$/);
    const replyId = updatedComment.replies[0].id;

    const updateResponse = await requestComments(
      handler,
      `/__sadoku/comments/${createdComment.id}/replies/${replyId}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: "  Updated context.  " }),
      },
    );
    const commentWithUpdatedReply = await updateResponse.json();

    assertEquals(updateResponse.status, 200);
    assertEquals(
      commentWithUpdatedReply.replies[0].body,
      "Updated context.",
    );
    assertEquals(commentWithUpdatedReply.replies[0].id, replyId);

    const invalidResponse = await requestComments(
      handler,
      `/__sadoku/comments/${createdComment.id}/replies`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: " " }),
      },
    );
    assertEquals(invalidResponse.status, 400);
    assertEquals(await invalidResponse.text(), "Comment body is required.");

    const deleteResponse = await requestComments(
      handler,
      `/__sadoku/comments/${createdComment.id}/replies/${replyId}`,
      { method: "DELETE" },
    );
    assertEquals(deleteResponse.status, 204);

    const storedResponse = await requestComments(
      handler,
      "/__sadoku/comments",
    );
    const storedDocument = await storedResponse.json();
    assertEquals(storedDocument.comments[0].replies, []);
  } finally {
    await removeTempMarkdown(filePath);
  }
});

testWithTempComments(
  "returns not found for missing comments and unknown actions",
  async () => {
    const filePath = await createTempMarkdown();
    const handler = createPreviewHandler(filePath);
    try {
      const cases: Array<[string, string, string]> = [
        ["PUT", "/__sadoku/comments/missing", "Comment not found."],
        ["DELETE", "/__sadoku/comments/missing", "Comment not found."],
        ["POST", "/__sadoku/comments/missing/resolve", "Comment not found."],
        ["POST", "/__sadoku/comments/missing/reopen", "Comment not found."],
        ["POST", "/__sadoku/comments/missing/replies", "Comment not found."],
        [
          "PUT",
          "/__sadoku/comments/missing/replies/reply-1",
          "Comment not found.",
        ],
        [
          "DELETE",
          "/__sadoku/comments/missing/replies/reply-1",
          "Comment not found.",
        ],
        ["POST", "/__sadoku/comments/missing/unknown", "Not found."],
        ["GET", "/__sadoku/comments/", "Comment not found."],
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
  },
);

testWithTempComments(
  "returns method not allowed for unsupported comment methods",
  async () => {
    const filePath = await createTempMarkdown();
    const handler = createPreviewHandler(filePath);
    try {
      const response = await requestComments(
        handler,
        "/__sadoku/comments/comment-1",
        { method: "PATCH" },
      );

      assertEquals(response.status, 405);
      assertEquals(await response.text(), "Method not allowed.");
    } finally {
      await removeTempMarkdown(filePath);
    }
  },
);

testWithTempComments("accepts URL-encoded comment identifiers", async () => {
  const filePath = await createTempMarkdown();
  const commentsPath = getCommentsFilePath(filePath);
  await Deno.mkdir(dirname(commentsPath), { recursive: true });
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
      "/__sadoku/comments/comment%20with%20spaces",
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
