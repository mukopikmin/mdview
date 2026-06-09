import { assertEquals, assertStringIncludes } from "@std/assert";
import { basename, join } from "@std/path";

import {
  formatCommentFilesTable,
  listCommentFiles,
  type ListedCommentFile,
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
