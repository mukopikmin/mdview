import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { basename, join } from "@std/path";

import {
  formatCommentFilesTable,
  inspectComments,
  listCommentFiles,
  type ListedCommentFile,
  removeCommentFile,
  replyToComment,
  resolveComments,
  shouldRemoveCommentFile,
} from "./comments.ts";
import {
  getCommentsDirectoryPath,
  getCommentsFilePath,
  writeCommentsDocument,
} from "../server/comments/storage.ts";
import {
  createTempMarkdown,
  removeTempMarkdown,
  withTempCommentsDirectory,
} from "../server/test_helpers.ts";

Deno.test("formats an empty comments file list", () => {
  assertEquals(formatCommentFilesTable([]), "No comment files found.\n");
});

Deno.test("formats listed comment files as a table", () => {
  const entries: ListedCommentFile[] = [{
    commentCount: 2,
    fileName: "README.md-12345678.json",
    markdownPath: "/repo/README.md",
    openCount: 1,
    updatedAt: "2026-06-08T14:00:00.000Z",
  }];

  assertEquals(
    formatCommentFilesTable(entries),
    "FILE                     MARKDOWN PATH    COMMENTS  OPEN  UPDATED\n" +
      "README.md-12345678.json  /repo/README.md  2         1     2026-06-08T14:00:00.000Z\n",
  );
});

Deno.test("lists comment files from the configured comments directory", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await createTempMarkdown();
    try {
      await writeCommentsDocument(filePath, {
        comments: [
          {
            body: "First",
            createdAt: "2026-06-08T13:00:00.000Z",
            id: "comment-1",
            line: 1,
            originalLine: 1,
            resolved: false,
            stale: false,
            updatedAt: "2026-06-08T13:00:00.000Z",
          },
          {
            body: "Second",
            createdAt: "2026-06-08T13:30:00.000Z",
            id: "comment-2",
            line: 3,
            originalLine: 3,
            resolved: true,
            stale: false,
            updatedAt: "2026-06-08T14:00:00.000Z",
          },
        ],
        filePath,
      });

      assertEquals(await listCommentFiles(), {
        entries: [{
          commentCount: 2,
          fileName: basename(getCommentsFilePath(filePath)),
          markdownPath: filePath,
          openCount: 1,
          updatedAt: "2026-06-08T14:00:00.000Z",
        }],
        warnings: [],
      });
    } finally {
      await removeTempMarkdown(filePath);
    }
  });
});

Deno.test("skips malformed comment files with a warning", async () => {
  await withTempCommentsDirectory(async () => {
    await Deno.writeTextFile(
      join(getCommentsDirectoryPath(), "broken.json"),
      "{",
    );

    const result = await listCommentFiles();

    assertEquals(result.entries, []);
    assertEquals(result.warnings.length, 1);
    assertStringIncludes(result.warnings[0], "Skipping broken.json:");
  });
});

Deno.test("parses confirmation answers for removing comment files", () => {
  assertEquals(shouldRemoveCommentFile("y"), true);
  assertEquals(shouldRemoveCommentFile("YES"), true);
  assertEquals(shouldRemoveCommentFile(" yes "), true);
  assertEquals(shouldRemoveCommentFile(""), false);
  assertEquals(shouldRemoveCommentFile("n"), false);
});

Deno.test("inspects unresolved comments with updated positions", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await createTempMarkdown("# Title\n\nAdded\nBody\n");
    try {
      await writeCommentsDocument(filePath, {
        comments: [
          {
            body: "Revise this.",
            createdAt: "2026-06-08T13:00:00.000Z",
            id: "comment-1",
            line: 3,
            originalLine: 3,
            resolved: false,
            sourceHash: "428a1095",
            sourceText: "Body",
            stale: false,
            updatedAt: "2026-06-08T13:00:00.000Z",
          },
          {
            body: "Done.",
            createdAt: "2026-06-08T13:00:00.000Z",
            id: "comment-2",
            line: 1,
            originalLine: 1,
            resolved: true,
            stale: false,
            updatedAt: "2026-06-08T13:00:00.000Z",
          },
        ],
        filePath,
      });

      const document = await inspectComments(filePath);

      assertEquals(document.filePath, filePath);
      assertEquals(document.comments.length, 1);
      assertEquals(document.comments[0].id, "comment-1");
      assertEquals(document.comments[0].line, 4);
      assertEquals(document.comments[0].stale, false);
    } finally {
      await removeTempMarkdown(filePath);
    }
  });
});

Deno.test("resolves selected comments atomically", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await createTempMarkdown();
    try {
      await writeCommentsDocument(filePath, {
        comments: [
          {
            body: "First",
            createdAt: "2026-06-08T13:00:00.000Z",
            id: "comment-1",
            line: 1,
            originalLine: 1,
            resolved: false,
            stale: false,
            updatedAt: "2026-06-08T13:00:00.000Z",
          },
          {
            body: "Second",
            createdAt: "2026-06-08T13:00:00.000Z",
            id: "comment-2",
            line: 3,
            originalLine: 3,
            resolved: false,
            stale: false,
            updatedAt: "2026-06-08T13:00:00.000Z",
          },
        ],
        filePath,
      });

      const resolved = await resolveComments(filePath, ["comment-2"]);
      const inspected = await inspectComments(filePath);

      assertEquals(resolved.comments.length, 1);
      assertEquals(resolved.comments[0].id, "comment-2");
      assertEquals(resolved.comments[0].resolved, true);
      assertEquals(typeof resolved.comments[0].resolvedAt, "string");
      assertEquals(inspected.comments.map((comment) => comment.id), [
        "comment-1",
      ]);

      await assertRejects(
        () => resolveComments(filePath, ["comment-1", "missing"]),
        Error,
        "Comment not found: missing",
      );
      assertEquals(
        (await inspectComments(filePath)).comments.map((comment) => comment.id),
        ["comment-1"],
      );
    } finally {
      await removeTempMarkdown(filePath);
    }
  });
});

Deno.test("adds replies to comments", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await createTempMarkdown();
    try {
      await writeCommentsDocument(filePath, {
        comments: [{
          body: "Question",
          createdAt: "2026-06-08T13:00:00.000Z",
          id: "comment-1",
          line: 3,
          originalLine: 3,
          resolved: false,
          stale: false,
          updatedAt: "2026-06-08T13:00:00.000Z",
        }],
        filePath,
      });

      const updated = await replyToComment(
        filePath,
        "comment-1",
        "  More context.  ",
      );

      assertEquals(updated.replies?.length, 1);
      assertEquals(updated.replies?.[0].body, "More context.");
      assertEquals(
        updated.replies?.[0].createdAt,
        updated.replies?.[0].updatedAt,
      );
      assertEquals(
        (await inspectComments(filePath)).comments[0].replies?.[0].body,
        "More context.",
      );
      await assertRejects(
        () => replyToComment(filePath, "missing", "Reply"),
        Error,
        "Comment not found: missing",
      );
      await assertRejects(
        () => replyToComment(filePath, "comment-1", " "),
        Error,
        "Reply body is required.",
      );
    } finally {
      await removeTempMarkdown(filePath);
    }
  });
});

Deno.test("removes a comment file from the configured comments directory", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await createTempMarkdown();
    try {
      await writeCommentsDocument(filePath, {
        comments: [],
        filePath,
      });
      const commentFileName = basename(getCommentsFilePath(filePath));

      await removeCommentFile(commentFileName);

      assertEquals(await listCommentFiles(), {
        entries: [],
        warnings: [],
      });
    } finally {
      await removeTempMarkdown(filePath);
    }
  });
});

Deno.test("rejects unsafe or missing comment files when removing", async () => {
  await withTempCommentsDirectory(async () => {
    await assertRejects(
      () => removeCommentFile("../README.md-12345678.json"),
      Error,
      "Comment file name must be a .json file without path separators.",
    );
    await assertRejects(
      () => removeCommentFile("README.md-12345678.txt"),
      Error,
      "Comment file name must be a .json file without path separators.",
    );
    await assertRejects(
      () => removeCommentFile("README.md-12345678.json"),
      Error,
      "Comment file not found: README.md-12345678.json",
    );
  });
});
