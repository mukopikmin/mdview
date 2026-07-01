import { assertEquals } from "@std/assert";

import type { PreviewComment } from "./types.ts";
import {
  getLineRangeText,
  getLineText,
  hashSourceText,
  resolveCommentPosition,
} from "./position.ts";

const createComment = (
  overrides: Partial<PreviewComment> = {},
): PreviewComment => ({
  body: "Review this.",
  createdAt: "2026-06-07T00:00:00.000Z",
  id: 1,
  line: 3,
  endLine: 3,
  originalLine: 3,
  originalEndLine: 3,
  resolved: false,
  sourceHash: hashSourceText("Body"),
  sourceText: "Body",
  stale: false,
  updatedAt: "2026-06-07T00:00:00.000Z",
  ...overrides,
});

Deno.test("gets Markdown lines using one-based line numbers", () => {
  assertEquals(getLineText("first\nsecond\n", 1), "first");
  assertEquals(getLineText("first\nsecond\n", 2), "second");
  assertEquals(getLineText("first\nsecond\n", 3), "");
  assertEquals(getLineText("first\nsecond\n", 4), undefined);
  assertEquals(getLineText("first\nsecond\n", 0), undefined);
});

Deno.test("gets Markdown line range text using one-based line numbers", () => {
  assertEquals(getLineRangeText("first\nsecond\nthird", 1, 2), "first\nsecond");
  assertEquals(getLineRangeText("first\nsecond\nthird", 2, 3), "second\nthird");
  assertEquals(getLineRangeText("first\nsecond", 2, 1), undefined);
  assertEquals(getLineRangeText("first\nsecond", 1, 3), undefined);
});

Deno.test("produces stable source hashes", () => {
  assertEquals(hashSourceText("Body"), "428a1095");
  assertEquals(hashSourceText(""), "811c9dc5");
  assertEquals(hashSourceText("Body"), hashSourceText("Body"));
});

Deno.test("keeps a comment at an unchanged source line", () => {
  const resolved = resolveCommentPosition(
    createComment(),
    "# Title\n\nBody\n",
  );

  assertEquals(resolved.displayLine, 3);
  assertEquals(resolved.line, 3);
  assertEquals(resolved.originalLine, 3);
  assertEquals(resolved.stale, false);
});

Deno.test("tracks a uniquely matching source line within forty lines", () => {
  const before = Array.from({ length: 40 }, (_, index) => `before ${index}`);
  const markdown = [...before, "Body", "after"].join("\n");
  const resolved = resolveCommentPosition(
    createComment({ line: 1, endLine: 1, originalLine: 1, originalEndLine: 1 }),
    markdown,
  );

  assertEquals(resolved.displayLine, 41);
  assertEquals(resolved.line, 41);
  assertEquals(resolved.originalLine, 1);
  assertEquals(resolved.stale, false);
});

Deno.test("does not track a matching source line outside the search radius", () => {
  const before = Array.from({ length: 41 }, (_, index) => `before ${index}`);
  const markdown = [...before, "Body"].join("\n");
  const resolved = resolveCommentPosition(
    createComment({ line: 1, endLine: 1, originalLine: 1, originalEndLine: 1 }),
    markdown,
  );

  assertEquals(resolved.displayLine, 1);
  assertEquals(resolved.line, 1);
  assertEquals(resolved.originalLine, 1);
  assertEquals(resolved.stale, true);
});

Deno.test("marks a comment stale when its source is ambiguous", () => {
  const resolved = resolveCommentPosition(
    createComment(),
    "# Title\nBody\nchanged\nBody\n",
  );

  assertEquals(resolved.displayLine, 3);
  assertEquals(resolved.line, 3);
  assertEquals(resolved.originalLine, 3);
  assertEquals(resolved.stale, true);
});

Deno.test("fills source metadata for legacy comments", () => {
  const resolved = resolveCommentPosition(
    createComment({ sourceHash: undefined, sourceText: undefined }),
    "# Title\n\nBody\n",
  );

  assertEquals(resolved.displayLine, 3);
  assertEquals(resolved.sourceText, "Body");
  assertEquals(resolved.sourceHash, hashSourceText("Body"));
  assertEquals(resolved.stale, false);
});

Deno.test("tracks a uniquely matching source range within forty lines", () => {
  const resolved = resolveCommentPosition(
    createComment({
      line: 1,
      endLine: 2,
      originalLine: 1,
      originalEndLine: 2,
      sourceHash: hashSourceText("alpha\nbeta"),
      sourceText: "alpha\nbeta",
    }),
    "intro\nalpha\nbeta\noutro",
  );

  assertEquals(resolved.line, 2);
  assertEquals(resolved.endLine, 3);
  assertEquals(resolved.originalLine, 1);
  assertEquals(resolved.originalEndLine, 2);
  assertEquals(resolved.stale, false);
});

Deno.test("marks a source range stale when matching ranges are ambiguous", () => {
  const resolved = resolveCommentPosition(
    createComment({
      line: 1,
      endLine: 2,
      originalLine: 1,
      originalEndLine: 2,
      sourceHash: hashSourceText("alpha\nbeta"),
      sourceText: "alpha\nbeta",
    }),
    "alpha\nbeta\nchanged\nalpha\nbeta",
  );

  assertEquals(resolved.line, 1);
  assertEquals(resolved.endLine, 2);
  assertEquals(resolved.stale, true);
});
