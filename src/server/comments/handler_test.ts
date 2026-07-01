import { assertEquals, assertMatch } from "@std/assert";
import { dirname } from "@std/path";

import type { CommentsStore } from "./storage.ts";
import { getCommentsFilePath } from "./storage.ts";
import type { PreviewCommentsDocument } from "./types.ts";
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

const createMemoryCommentsStore = (): {
  documents: Map<string, PreviewCommentsDocument>;
  store: CommentsStore;
  writes: PreviewCommentsDocument[];
} => {
  const documents = new Map<string, PreviewCommentsDocument>();
  const writes: PreviewCommentsDocument[] = [];
  const cloneDocument = (
    document: PreviewCommentsDocument,
  ): PreviewCommentsDocument => structuredClone(document);

  return {
    documents,
    store: {
      read: (filePath) =>
        Promise.resolve(
          cloneDocument(
            documents.get(filePath) ?? {
              comments: [],
              filePath,
            },
          ),
        ),
      write: (filePath, document) => {
        const stored = cloneDocument(document);
        documents.set(filePath, stored);
        writes.push(stored);
        return Promise.resolve();
      },
    },
    writes,
  };
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

testWithTempComments("uses an injected comments store", async () => {
  const filePath = await createTempMarkdown();
  const { documents, store, writes } = createMemoryCommentsStore();
  const handler = createPreviewHandler(filePath, { commentsStore: store });

  try {
    const createResponse = await requestComments(
      handler,
      "/__sadoku/comments",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ line: 3, body: "Stored elsewhere." }),
      },
    );
    const createdComment = await createResponse.json();

    assertEquals(createResponse.status, 200);
    assertEquals(writes.length, 1);
    assertEquals(
      documents.get(filePath)?.comments[0].body,
      "Stored elsewhere.",
    );

    const listResponse = await requestComments(handler, "/__sadoku/comments");
    const listedDocument = await listResponse.json();

    assertEquals(listResponse.status, 200);
    assertEquals(listedDocument.filePath, filePath);
    assertEquals(listedDocument.comments[0].displayLine, 3);
    assertEquals(listedDocument.comments[0].body, "Stored elsewhere.");

    const updateResponse = await requestComments(
      handler,
      `/__sadoku/comments/${createdComment.id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: "Updated elsewhere." }),
      },
    );
    const updatedComment = await updateResponse.json();

    assertEquals(updateResponse.status, 200);
    assertEquals(updatedComment.body, "Updated elsewhere.");
    assertEquals(writes.length, 2);
    assertEquals(
      documents.get(filePath)?.comments[0].body,
      "Updated elsewhere.",
    );
    assertEquals(
      await Deno.stat(getCommentsFilePath(filePath)).catch((error) => {
        if (error instanceof Deno.errors.NotFound) return undefined;
        throw error;
      }),
      undefined,
    );
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
    assertEquals(comment.id, 1);
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
    assertEquals(updatedComment.replies[0].id, 1);
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
          "/__sadoku/comments/missing/replies/1",
          "Comment not found.",
        ],
        [
          "DELETE",
          "/__sadoku/comments/missing/replies/1",
          "Comment not found.",
        ],
        ["POST", "/__sadoku/comments/1/unknown", "Not found."],
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
        "/__sadoku/comments/1",
        { method: "PATCH" },
      );

      assertEquals(response.status, 405);
      assertEquals(await response.text(), "Method not allowed.");
    } finally {
      await removeTempMarkdown(filePath);
    }
  },
);

testWithTempComments("accepts numeric comment identifiers", async () => {
  const filePath = await createTempMarkdown();
  const commentsPath = getCommentsFilePath(filePath);
  await Deno.mkdir(dirname(commentsPath), { recursive: true });
  await Deno.writeTextFile(
    commentsPath,
    JSON.stringify({
      comments: [{
        body: "Original",
        createdAt: "2026-06-07T00:00:00.000Z",
        id: 1,
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
      "/__sadoku/comments/1",
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

testWithTempComments(
  "stores URL comments by URL without query string or fragment",
  async () => {
    const source = Deno.serve(
      { hostname: "127.0.0.1", port: 0, onListen: () => {} },
      (request) => {
        const url = new URL(request.url);
        return new Response(`# Remote ${url.searchParams.get("token")}\n`);
      },
    );
    const baseUrl = `http://127.0.0.1:${source.addr.port}/remote.md`;
    const firstHandler = createPreviewHandler(`${baseUrl}?token=a#section`);
    const secondHandler = createPreviewHandler(`${baseUrl}?token=b`);

    try {
      const createResponse = await requestComments(
        firstHandler,
        "/__sadoku/comments",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ line: 1, body: "Review remote source." }),
        },
      );
      const comment = await createResponse.json();

      assertEquals(createResponse.status, 200);
      assertEquals(comment.sourceText, "# Remote a");

      const listResponse = await requestComments(
        secondHandler,
        "/__sadoku/comments",
      );
      const document = await listResponse.json();

      assertEquals(listResponse.status, 200);
      assertEquals(document.filePath, baseUrl);
      assertEquals(document.comments.length, 1);
      assertEquals(document.comments[0].body, "Review remote source.");
      assertEquals(document.comments[0].stale, true);
    } finally {
      await source.shutdown().catch(() => {});
      await source.finished.catch(() => {});
    }
  },
);
