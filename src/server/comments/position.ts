import type { PreviewComment, PreviewCommentsDocument } from "./types.ts";
import { readCommentsDocument } from "./storage.ts";
import { readMarkdownSource } from "../source.ts";

const lineSearchRadius = 40;

const getMarkdownLines = (markdown: string): string[] => markdown.split("\n");

export const getLineText = (
  markdown: string,
  line: number,
): string | undefined => getMarkdownLines(markdown)[line - 1];

export const getLineRangeText = (
  markdown: string,
  line: number,
  endLine = line,
): string | undefined => {
  if (line < 1 || endLine < line) return undefined;
  const lines = getMarkdownLines(markdown);
  if (endLine > lines.length) return undefined;
  return lines.slice(line - 1, endLine).join("\n");
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
  const sourceText = comment.sourceText ??
    getLineRangeText(markdown, comment.line, endLine) ??
    "";
  const sourceHash = comment.sourceHash ?? hashSourceText(sourceText);
  const currentRangeText = getLineRangeText(markdown, comment.line, endLine);

  if (
    currentRangeText !== undefined &&
    currentRangeText === sourceText &&
    hashSourceText(currentRangeText) === sourceHash
  ) {
    return {
      ...comment,
      displayLine: comment.line,
      endLine,
      originalEndLine: endLine,
      originalLine: comment.line,
      sourceHash,
      sourceText,
      stale: false,
    };
  }

  const lines = getMarkdownLines(markdown);
  const startLine = Math.max(1, comment.line - lineSearchRadius);
  const searchEndLine = Math.min(lines.length, comment.line + lineSearchRadius);
  const rangeLength = endLine - comment.line + 1;
  const matchingLines: Array<{ endLine: number; line: number }> = [];

  for (let line = startLine; line <= searchEndLine; line += 1) {
    const candidateEndLine = line + rangeLength - 1;
    const lineText = getLineRangeText(markdown, line, candidateEndLine);
    if (
      lineText !== undefined &&
      lineText === sourceText &&
      hashSourceText(lineText) === sourceHash
    ) {
      matchingLines.push({ endLine: candidateEndLine, line });
    }
  }

  if (matchingLines.length === 1) {
    const match = matchingLines[0];
    return {
      ...comment,
      displayLine: match.line,
      endLine: match.endLine,
      line: match.line,
      originalEndLine: endLine,
      originalLine: comment.line,
      sourceHash,
      sourceText,
      stale: false,
    };
  }

  return {
    ...comment,
    displayLine: comment.line,
    endLine,
    originalEndLine: endLine,
    originalLine: comment.line,
    sourceHash,
    sourceText,
    stale: true,
  };
};

export const readResolvedCommentsDocument = async (
  filePath: string,
  markdownSource = filePath,
): Promise<PreviewCommentsDocument> => {
  const [document, markdown] = await Promise.all([
    readCommentsDocument(filePath),
    readMarkdownSource(markdownSource),
  ]);
  return {
    comments: document.comments.map((comment) =>
      resolveCommentPosition(comment, markdown)
    ),
    filePath,
  };
};
