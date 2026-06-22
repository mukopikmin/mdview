import { assertEquals, assertRejects } from "@std/assert";

import type { PreviewCommentsDocument } from "./types.ts";
import {
  getCommentsFilePath,
  getLegacyCommentsFilePath,
  readCommentsDocument,
  writeCommentsDocument,
} from "./storage.ts";
import {
  createTempMarkdown,
  removeTempMarkdown,
  withTempCommentsDirectory,
} from "../test_helpers.ts";

Deno.test("returns an empty comments document when storage does not exist", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await createTempMarkdown();
    try {
      assertEquals(await readCommentsDocument(filePath), {
        comments: [],
        filePath,
      });
    } finally {
      await removeTempMarkdown(filePath);
    }
  });
});

Deno.test("writes formatted comments JSON with a trailing newline", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await createTempMarkdown();
    const document: PreviewCommentsDocument = {
      comments: [{
        body: "Review this.",
        createdAt: "2026-06-07T00:00:00.000Z",
        id: "comment-1",
        line: 3,
        originalLine: 3,
        resolved: false,
        sourceText: "Body",
        stale: false,
        updatedAt: "2026-06-07T00:00:00.000Z",
      }],
      filePath,
    };

    try {
      await writeCommentsDocument(filePath, document);
      const stored = await Deno.readTextFile(getCommentsFilePath(filePath));

      assertEquals(stored.endsWith("\n"), true);
      assertEquals(JSON.parse(stored), document);
    } finally {
      await removeTempMarkdown(filePath);
    }
  });
});

Deno.test("filters invalid stored comments and normalizes legacy resolution", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await createTempMarkdown();
    try {
      await Deno.writeTextFile(
        getCommentsFilePath(filePath),
        JSON.stringify({
          comments: [
            {
              body: "Legacy comment",
              createdAt: "2026-06-07T00:00:00.000Z",
              id: "comment-1",
              line: 3,
              updatedAt: "2026-06-07T00:00:00.000Z",
            },
            { id: "missing-required-fields" },
            null,
          ],
          filePath: "/untrusted/path.md",
        }),
      );

      const document = await readCommentsDocument(filePath);

      assertEquals(document.filePath, filePath);
      assertEquals(document.comments.length, 1);
      assertEquals(document.comments[0].id, "comment-1");
      assertEquals(document.comments[0].replies, []);
      assertEquals(document.comments[0].resolved, false);
    } finally {
      await removeTempMarkdown(filePath);
    }
  });
});

Deno.test("treats a stored document without a comments array as empty", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await createTempMarkdown();
    try {
      await Deno.writeTextFile(
        getCommentsFilePath(filePath),
        JSON.stringify({ comments: "invalid" }),
      );

      assertEquals(await readCommentsDocument(filePath), {
        comments: [],
        filePath,
      });
    } finally {
      await removeTempMarkdown(filePath);
    }
  });
});

Deno.test("rejects malformed comments JSON", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await createTempMarkdown();
    try {
      await Deno.writeTextFile(getCommentsFilePath(filePath), "{");

      await assertRejects(
        () => readCommentsDocument(filePath),
        SyntaxError,
      );
    } finally {
      await removeTempMarkdown(filePath);
    }
  });
});

Deno.test("reads legacy comments stored next to the Markdown file", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await createTempMarkdown();
    try {
      await Deno.writeTextFile(
        getLegacyCommentsFilePath(filePath),
        JSON.stringify({
          comments: [{
            body: "Legacy comment",
            createdAt: "2026-06-07T00:00:00.000Z",
            id: "comment-1",
            line: 3,
            updatedAt: "2026-06-07T00:00:00.000Z",
          }],
          filePath,
        }),
      );

      const document = await readCommentsDocument(filePath);

      assertEquals(document.comments.length, 1);
      assertEquals(document.comments[0].id, "comment-1");
    } finally {
      await removeTempMarkdown(filePath);
      await Deno.remove(getLegacyCommentsFilePath(filePath)).catch(() => {});
    }
  });
});

Deno.test("reads comments from legacy mdview comments directory", async () => {
  const previousHome = Deno.env.get("HOME");
  const previousSadoku = Deno.env.get("SADOKU_COMMENTS_DIR");
  const previousMdview = Deno.env.get("MDVIEW_COMMENTS_DIR");
  const home = await Deno.makeTempDir({ prefix: "sadoku-home-" });
  Deno.env.set("HOME", home);
  Deno.env.delete("SADOKU_COMMENTS_DIR");
  Deno.env.delete("MDVIEW_COMMENTS_DIR");

  const filePath = await createTempMarkdown();
  try {
    const legacyDirectory = `${home}/.local/share/mdview/comments`;
    await Deno.mkdir(legacyDirectory, { recursive: true });
    const legacyFileName = getCommentsFilePath(filePath).split("/").at(-1);
    if (!legacyFileName) throw new Error("Missing comments file name.");
    await Deno.writeTextFile(
      `${legacyDirectory}/${legacyFileName}`,
      JSON.stringify({
        comments: [{
          body: "Legacy directory comment",
          createdAt: "2026-06-07T00:00:00.000Z",
          id: "comment-1",
          line: 3,
          updatedAt: "2026-06-07T00:00:00.000Z",
        }],
        filePath,
      }),
    );

    const document = await readCommentsDocument(filePath);

    assertEquals(document.comments.length, 1);
    assertEquals(document.comments[0].body, "Legacy directory comment");
  } finally {
    await removeTempMarkdown(filePath);
    if (previousHome === undefined) Deno.env.delete("HOME");
    else Deno.env.set("HOME", previousHome);
    if (previousSadoku === undefined) Deno.env.delete("SADOKU_COMMENTS_DIR");
    else Deno.env.set("SADOKU_COMMENTS_DIR", previousSadoku);
    if (previousMdview === undefined) Deno.env.delete("MDVIEW_COMMENTS_DIR");
    else Deno.env.set("MDVIEW_COMMENTS_DIR", previousMdview);
    await Deno.remove(home, { recursive: true }).catch(() => {});
  }
});
