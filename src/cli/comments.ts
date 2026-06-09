import { basename, join } from "@std/path";
import { getCommentsDirectoryPath } from "../server/comments/storage.ts";

type StoredComment = {
  resolved?: boolean;
  updatedAt: string;
};

type StoredCommentsDocument = {
  comments: StoredComment[];
  filePath: string;
};

export type ListedCommentFile = {
  commentCount: number;
  fileName: string;
  markdownPath: string;
  openCount: number;
  updatedAt: string | undefined;
};

export type ListCommentFilesResult = {
  entries: ListedCommentFile[];
  warnings: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isStoredComment = (value: unknown): value is StoredComment =>
  isRecord(value) && typeof value.updatedAt === "string";

const parseStoredCommentsDocument = (
  text: string,
): StoredCommentsDocument => {
  const value = JSON.parse(text) as unknown;
  if (!isRecord(value) || !Array.isArray(value.comments)) {
    throw new Error("Invalid comments document.");
  }

  return {
    comments: value.comments.filter(isStoredComment),
    filePath: typeof value.filePath === "string" ? value.filePath : "",
  };
};

const latestUpdatedAt = (
  comments: StoredComment[],
): string | undefined =>
  comments.map((comment) => comment.updatedAt).sort().at(-1);

export const listCommentFiles = async (): Promise<ListCommentFilesResult> => {
  const commentsDirectoryPath = getCommentsDirectoryPath();
  const directoryEntries = await Array.fromAsync(
    Deno.readDir(commentsDirectoryPath),
  ).catch((error) => {
    if (error instanceof Deno.errors.NotFound) return [];
    throw error;
  });
  const entries: ListedCommentFile[] = [];
  const warnings: string[] = [];

  for (const entry of directoryEntries) {
    if (!entry.isFile || !entry.name.endsWith(".json")) continue;

    const filePath = join(commentsDirectoryPath, entry.name);
    try {
      const document = parseStoredCommentsDocument(
        await Deno.readTextFile(filePath),
      );
      entries.push({
        commentCount: document.comments.length,
        fileName: basename(filePath),
        markdownPath: document.filePath,
        openCount: document.comments.filter((comment) =>
          comment.resolved !== true
        ).length,
        updatedAt: latestUpdatedAt(document.comments),
      });
    } catch (error) {
      warnings.push(
        `Skipping ${entry.name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  return {
    entries: entries.sort((left, right) =>
      left.fileName.localeCompare(right.fileName)
    ),
    warnings,
  };
};

const pad = (value: string, width: number): string => value.padEnd(width, " ");

export const formatCommentFilesTable = (
  entries: ListedCommentFile[],
): string => {
  if (entries.length === 0) return "No comment files found.\n";

  const rows = entries.map((entry) => [
    entry.fileName,
    entry.markdownPath || "-",
    entry.commentCount.toString(),
    entry.openCount.toString(),
    entry.updatedAt ?? "-",
  ]);
  const headers = ["FILE", "MARKDOWN PATH", "COMMENTS", "OPEN", "UPDATED"];
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => row[index].length))
  );
  const formatRow = (row: string[]): string =>
    row.map((value, index) => pad(value, widths[index])).join("  ").trimEnd();

  return `${formatRow(headers)}\n${rows.map(formatRow).join("\n")}\n`;
};
