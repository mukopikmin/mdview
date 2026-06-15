import type { PreviewComment, PreviewCommentsDocument } from "./types.ts";
import { readCommentsDocument } from "./storage.ts";

const lineSearchRadius = 40;

const getMarkdownLines = (markdown: string): string[] => markdown.split("\n");

export const getLineText = (
  markdown: string,
  line: number,
): string | undefined => getMarkdownLines(markdown)[line - 1];

export const hashSourceText = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

export const resolveCommentPosition = (
  comment: PreviewComment,
  markdown: string,
): PreviewComment => {
  const sourceText = comment.sourceText ??
    getLineText(markdown, comment.line) ??
    "";
  const sourceHash = comment.sourceHash ?? hashSourceText(sourceText);
  const currentLineText = getLineText(markdown, comment.line);

  if (
    currentLineText !== undefined &&
    currentLineText === sourceText &&
    hashSourceText(currentLineText) === sourceHash
  ) {
    return {
      ...comment,
      originalLine: comment.line,
      sourceHash,
      sourceText,
      stale: false,
    };
  }

  const lines = getMarkdownLines(markdown);
  const startLine = Math.max(1, comment.line - lineSearchRadius);
  const endLine = Math.min(lines.length, comment.line + lineSearchRadius);
  const matchingLines: number[] = [];

  for (let line = startLine; line <= endLine; line += 1) {
    const lineText = lines[line - 1];
    if (lineText === sourceText && hashSourceText(lineText) === sourceHash) {
      matchingLines.push(line);
    }
  }

  if (matchingLines.length === 1) {
    return {
      ...comment,
      line: matchingLines[0],
      originalLine: comment.line,
      sourceHash,
      sourceText,
      stale: false,
    };
  }

  return {
    ...comment,
    originalLine: comment.line,
    sourceHash,
    sourceText,
    stale: true,
  };
};

export const readResolvedCommentsDocument = async (
  filePath: string,
): Promise<PreviewCommentsDocument> => {
  const [document, markdown] = await Promise.all([
    readCommentsDocument(filePath),
    Deno.readTextFile(filePath),
  ]);
  return {
    comments: document.comments.map((comment) =>
      resolveCommentPosition(comment, markdown)
    ),
    filePath,
  };
};
