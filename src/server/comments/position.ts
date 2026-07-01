import type { PreviewComment, PreviewCommentsDocument } from "./types.ts";
import { type CommentsStore, fileCommentsStore } from "./storage.ts";
import { readMarkdownSource } from "../source.ts";

const lineSearchRadius = 40;

const getMarkdownLines = (markdown: string): string[] => markdown.split("\n");

export const getLineText = (
  markdown: string,
  line: number,
): string | undefined => getMarkdownLines(markdown)[line - 1];

export const getLineRangeText = (
  markdown: string,
  startLine: number,
  endLine: number,
): string | undefined => {
  if (startLine < 1 || endLine < startLine) return undefined;
  const lines = getMarkdownLines(markdown);
  if (endLine > lines.length) return undefined;
  return lines.slice(startLine - 1, endLine).join("\n");
};

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
  const endLine = comment.endLine ?? comment.line;
  const rangeLength = Math.max(1, endLine - comment.line + 1);
  const sourceText = comment.sourceText ??
    getLineRangeText(markdown, comment.line, endLine) ??
    getLineText(markdown, comment.line) ??
    "";
  const sourceHash = comment.sourceHash ?? hashSourceText(sourceText);

  const lines = getMarkdownLines(markdown);
  const startLine = Math.max(1, comment.line - lineSearchRadius);
  const lastCandidateLine = Math.max(1, lines.length - rangeLength + 1);
  const endSearchLine = Math.min(
    lastCandidateLine,
    comment.line + lineSearchRadius,
  );
  const matchingLines: number[] = [];

  for (let line = startLine; line <= endSearchLine; line += 1) {
    const rangeText = lines.slice(line - 1, line - 1 + rangeLength).join("\n");
    if (rangeText === sourceText && hashSourceText(rangeText) === sourceHash) {
      matchingLines.push(line);
    }
  }

  if (matchingLines.length === 1) {
    return {
      ...comment,
      displayLine: matchingLines[0],
      line: matchingLines[0],
      endLine: matchingLines[0] + rangeLength - 1,
      originalLine: comment.line,
      originalEndLine: endLine,
      sourceHash,
      sourceText,
      stale: false,
    };
  }

  return {
    ...comment,
    displayLine: comment.line,
    endLine,
    originalLine: comment.line,
    originalEndLine: endLine,
    sourceHash,
    sourceText,
    stale: true,
  };
};

export const readResolvedCommentsDocument = async (
  filePath: string,
  markdownSource = filePath,
  commentsStore: CommentsStore = fileCommentsStore,
): Promise<PreviewCommentsDocument> => {
  const [document, markdown] = await Promise.all([
    commentsStore.read(filePath),
    readMarkdownSource(markdownSource),
  ]);
  return {
    comments: document.comments.map((comment) =>
      resolveCommentPosition(comment, markdown)
    ),
    filePath,
  };
};
