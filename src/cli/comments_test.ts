import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { basename, join, relative, resolve } from "@std/path";

import {
  formatCommentFilesTable,
  inspectComments,
  listCommentFiles,
  type ListedCommentFile,
  removeComments,
  removeCommentsIfConfirmed,
  replyToComment,
  resolveComments,
  shouldRemoveComments,
} from "./comments.ts";
import {
  type CommentsStore,
  type CommentsStoreFile,
  getCommentsDirectoryPath,
  getCommentsFilePath,
  writeCommentsDocument,
} from "../server/comments/storage.ts";
import type { PreviewCommentsDocument } from "../server/comments/types.ts";
import {
  createTempMarkdown,
  removeTempMarkdown,
  withTempCommentsDirectory,
} from "../server/test_helpers.ts";

const createMemoryCommentsStore = (): {
  documents: Map<string, PreviewCommentsDocument>;
  store: CommentsStore;
} => {
  const documents = new Map<string, PreviewCommentsDocument>();
  const cloneDocument = (
    document: PreviewCommentsDocument,
  ): PreviewCommentsDocument => structuredClone(document);
  const latestUpdatedAt = (document: PreviewCommentsDocument) =>
    document.comments.map((comment) => comment.updatedAt).sort().at(-1);

  return {
    documents,
    store: {
      delete: (filePath) => {
        if (!documents.delete(filePath)) {
          return Promise.reject(new Deno.errors.NotFound());
        }
        return Promise.resolve();
      },
      list: () => {
        const entries: CommentsStoreFile[] = [...documents.entries()].map(
          ([filePath, document]) => ({
            commentCount: document.comments.length,
            fileName: `${filePath}.memory`,
            markdownPath: document.filePath,
            openCount:
              document.comments.filter((comment) => comment.resolved !== true)
                .length,
            updatedAt: latestUpdatedAt(document),
          }),
        );
        entries.sort((left, right) =>
          left.fileName.localeCompare(
            right.fileName,
          )
        );
        return Promise.resolve({ entries, warnings: [] });
      },
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
        documents.set(filePath, cloneDocument(document));
        return Promise.resolve();
      },
    },
  };
};

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
            id: 1,
            line: 1,
            originalLine: 1,
            resolved: false,
            stale: false,
            updatedAt: "2026-06-08T13:00:00.000Z",
          },
          {
            body: "Second",
            createdAt: "2026-06-08T13:30:00.000Z",
            id: 2,
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

Deno.test("parses confirmation answers for removing comments", () => {
  assertEquals(shouldRemoveComments("y"), true);
  assertEquals(shouldRemoveComments("YES"), true);
  assertEquals(shouldRemoveComments(" yes "), true);
  assertEquals(shouldRemoveComments(""), false);
  assertEquals(shouldRemoveComments("n"), false);
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
            id: 1,
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
            id: 2,
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
      assertEquals(document.comments[0].id, 1);
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
            id: 1,
            line: 1,
            originalLine: 1,
            resolved: false,
            stale: false,
            updatedAt: "2026-06-08T13:00:00.000Z",
          },
          {
            body: "Second",
            createdAt: "2026-06-08T13:00:00.000Z",
            id: 2,
            line: 3,
            originalLine: 3,
            resolved: false,
            stale: false,
            updatedAt: "2026-06-08T13:00:00.000Z",
          },
        ],
        filePath,
      });

      const resolved = await resolveComments(filePath, ["2"]);
      const inspected = await inspectComments(filePath);

      assertEquals(resolved.comments.length, 1);
      assertEquals(resolved.comments[0].id, 2);
      assertEquals(resolved.comments[0].resolved, true);
      assertEquals(typeof resolved.comments[0].resolvedAt, "string");
      assertEquals(inspected.comments.map((comment) => comment.id), [
        1,
      ]);

      await assertRejects(
        () => resolveComments(filePath, ["1", "missing"]),
        Error,
        "Comment not found: missing",
      );
      assertEquals(
        (await inspectComments(filePath)).comments.map((comment) => comment.id),
        [1],
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
          id: 1,
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
        "1",
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
        () => replyToComment(filePath, "1", " "),
        Error,
        "Reply body is required.",
      );
    } finally {
      await removeTempMarkdown(filePath);
    }
  });
});

Deno.test("uses an injected comments store for CLI operations", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await createTempMarkdown();
    const { documents, store } = createMemoryCommentsStore();
    const options = { commentsStore: store };
    try {
      documents.set(filePath, {
        comments: [{
          body: "Question",
          createdAt: "2026-06-08T13:00:00.000Z",
          id: 1,
          line: 3,
          originalLine: 3,
          resolved: false,
          sourceText: "Body",
          stale: false,
          updatedAt: "2026-06-08T13:00:00.000Z",
        }],
        filePath,
      });

      const inspected = await inspectComments(filePath, options);
      assertEquals(inspected.comments.map((comment) => comment.id), [1]);

      const replied = await replyToComment(
        filePath,
        "1",
        "  Stored elsewhere.  ",
        options,
      );
      assertEquals(replied.replies?.[0].body, "Stored elsewhere.");

      const resolved = await resolveComments(filePath, ["1"], options);
      assertEquals(resolved.comments[0].resolved, true);
      assertEquals(
        (await listCommentFiles(options)).entries[0].openCount,
        0,
      );

      assertEquals(await removeComments(filePath, options), filePath);
      assertEquals(await listCommentFiles(options), {
        entries: [],
        warnings: [],
      });
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
});

Deno.test("operates on URL comments by URL without query string or fragment", async () => {
  await withTempCommentsDirectory(async () => {
    const server = Deno.serve(
      { hostname: "127.0.0.1", port: 0, onListen: () => {} },
      (request) => {
        const url = new URL(request.url);
        return new Response(
          `# Remote ${url.searchParams.get("token")}\nBody\n`,
        );
      },
    );
    const baseUrl = `http://127.0.0.1:${server.addr.port}/remote.md`;

    try {
      await writeCommentsDocument(baseUrl, {
        comments: [
          {
            body: "URL comment",
            createdAt: "2026-06-08T13:00:00.000Z",
            id: 1,
            line: 1,
            originalLine: 1,
            resolved: false,
            sourceText: "# Remote a",
            stale: false,
            updatedAt: "2026-06-08T13:00:00.000Z",
          },
          {
            body: "Resolve me",
            createdAt: "2026-06-08T13:00:00.000Z",
            id: 2,
            line: 2,
            originalLine: 2,
            resolved: false,
            sourceText: "Body",
            stale: false,
            updatedAt: "2026-06-08T13:00:00.000Z",
          },
        ],
        filePath: baseUrl,
      });

      const inspected = await inspectComments(`${baseUrl}?token=a#section`);
      assertEquals(inspected.filePath, baseUrl);
      assertEquals(inspected.comments.length, 2);
      assertEquals(inspected.comments[0].stale, false);

      const replied = await replyToComment(
        `${baseUrl}?token=a`,
        "1",
        "  URL reply.  ",
      );
      assertEquals(replied.replies?.[0].body, "URL reply.");

      const resolved = await resolveComments(`${baseUrl}?token=b`, [
        "2",
      ]);
      assertEquals(resolved.filePath, baseUrl);
      assertEquals(resolved.comments[0].resolved, true);
      assertEquals(
        (await inspectComments(`${baseUrl}?token=a`)).comments.length,
        1,
      );

      assertEquals(await removeComments(`${baseUrl}?token=c`), baseUrl);
      assertEquals((await listCommentFiles()).entries, []);
    } finally {
      await server.shutdown().catch(() => {});
      await server.finished.catch(() => {});
    }
  });
});

Deno.test("removes comments for the specified Markdown file", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await createTempMarkdown();
    const otherFilePath = await createTempMarkdown();
    try {
      await writeCommentsDocument(filePath, {
        comments: [],
        filePath,
      });
      await writeCommentsDocument(otherFilePath, {
        comments: [],
        filePath: otherFilePath,
      });

      const removedFilePath = await removeComments(filePath);

      assertEquals(removedFilePath, filePath);
      assertEquals(await listCommentFiles(), {
        entries: [{
          commentCount: 0,
          fileName: basename(getCommentsFilePath(otherFilePath)),
          markdownPath: otherFilePath,
          openCount: 0,
          updatedAt: undefined,
        }],
        warnings: [],
      });
    } finally {
      await removeTempMarkdown(filePath);
      await removeTempMarkdown(otherFilePath);
    }
  });
});

Deno.test("resolves relative Markdown paths when removing comments", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await createTempMarkdown();
    try {
      await writeCommentsDocument(filePath, {
        comments: [],
        filePath,
      });

      const relativeFilePath = relative(Deno.cwd(), filePath);
      assertEquals(await removeComments(relativeFilePath), resolve(filePath));
      assertEquals((await listCommentFiles()).entries, []);
    } finally {
      await removeTempMarkdown(filePath);
    }
  });
});

Deno.test("keeps comments when removal confirmation is declined", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await createTempMarkdown();
    try {
      await writeCommentsDocument(filePath, {
        comments: [],
        filePath,
      });

      assertEquals(await removeCommentsIfConfirmed(filePath, "n"), undefined);
      assertEquals((await listCommentFiles()).entries.length, 1);
    } finally {
      await removeTempMarkdown(filePath);
    }
  });
});

Deno.test("rejects missing Markdown files or comments when removing", async () => {
  await withTempCommentsDirectory(async () => {
    const missingFilePath = resolve("missing-comments-target.md");
    await assertRejects(
      () => removeComments(missingFilePath),
      Error,
      `Markdown file not found: ${missingFilePath}`,
    );

    const directoryPath = await Deno.makeTempDir();
    try {
      await assertRejects(
        () => removeComments(directoryPath),
        Error,
        `Markdown path is not a file: ${directoryPath}`,
      );
    } finally {
      await Deno.remove(directoryPath);
    }

    const filePath = await createTempMarkdown();
    try {
      await assertRejects(
        () => removeComments(filePath),
        Error,
        `Comments not found for Markdown file: ${filePath}`,
      );
    } finally {
      await removeTempMarkdown(filePath);
    }
  });
});
