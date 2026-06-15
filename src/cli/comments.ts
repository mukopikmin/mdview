import { basename, join, resolve } from "@std/path";
import {
  getCommentsDirectoryPath,
  readCommentsDocument,
  writeCommentsDocument,
} from "../server/comments/storage.ts";
import {
  readResolvedCommentsDocument,
  resolveCommentPosition,
} from "../server/comments/position.ts";
import type {
  PreviewComment,
  PreviewCommentReply,
  PreviewCommentsDocument,
} from "../server/comments/types.ts";

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

const isSafeCommentFileName = (fileName: string): boolean =>
  fileName !== "" &&
  fileName === basename(fileName) &&
  !fileName.includes("/") &&
  !fileName.includes("\\") &&
  !fileName.includes("..") &&
  fileName.endsWith(".json");

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

export const shouldRemoveCommentFile = (answer: string): boolean =>
  ["y", "yes"].includes(answer.trim().toLowerCase());

export const inspectComments = async (
  filePath: string,
): Promise<PreviewCommentsDocument> => {
  const resolvedFilePath = resolve(filePath);
  const document = await readResolvedCommentsDocument(resolvedFilePath);
  return {
    comments: document.comments.filter((comment) => !comment.resolved),
    filePath: resolvedFilePath,
  };
};

export const resolveComments = async (
  filePath: string,
  commentIds: string[],
): Promise<PreviewCommentsDocument> => {
  if (commentIds.length === 0) {
    throw new Error("At least one comment ID is required.");
  }

  const resolvedFilePath = resolve(filePath);
  const document = await readCommentsDocument(resolvedFilePath);
  const requestedIds = new Set(commentIds);
  const knownIds = new Set(document.comments.map((comment) => comment.id));
  const missingIds = [...requestedIds].filter((id) => !knownIds.has(id));
  if (missingIds.length > 0) {
    throw new Error(`Comment not found: ${missingIds.join(", ")}`);
  }

  const now = new Date().toISOString();
  const updatedDocument = {
    comments: document.comments.map((comment) =>
      requestedIds.has(comment.id)
        ? {
          ...comment,
          resolved: true,
          resolvedAt: now,
          updatedAt: now,
        }
        : comment
    ),
    filePath: resolvedFilePath,
  };
  await writeCommentsDocument(resolvedFilePath, updatedDocument);
  return {
    comments: updatedDocument.comments.filter((comment) =>
      requestedIds.has(comment.id)
    ),
    filePath: resolvedFilePath,
  };
};

export const replyToComment = async (
  filePath: string,
  commentId: string,
  body: string,
): Promise<PreviewComment> => {
  const replyBody = body.trim();
  if (replyBody === "") {
    throw new Error("Reply body is required.");
  }

  const resolvedFilePath = resolve(filePath);
  const document = await readCommentsDocument(resolvedFilePath);
  const index = document.comments.findIndex((comment) =>
    comment.id === commentId
  );
  if (index < 0) {
    throw new Error(`Comment not found: ${commentId}`);
  }

  const now = new Date().toISOString();
  const reply: PreviewCommentReply = {
    body: replyBody,
    createdAt: now,
    id: crypto.randomUUID(),
    updatedAt: now,
  };
  const updatedComment = {
    ...document.comments[index],
    replies: [...(document.comments[index].replies ?? []), reply],
    updatedAt: now,
  };
  const comments = [...document.comments];
  comments[index] = updatedComment;
  await writeCommentsDocument(resolvedFilePath, {
    comments,
    filePath: resolvedFilePath,
  });
  return resolveCommentPosition(
    updatedComment,
    await Deno.readTextFile(resolvedFilePath),
  );
};

export const removeCommentFile = async (
  fileName: string,
): Promise<void> => {
  if (!isSafeCommentFileName(fileName)) {
    throw new Error(
      "Comment file name must be a .json file without path separators.",
    );
  }

  await Deno.remove(join(getCommentsDirectoryPath(), fileName)).catch(
    (error) => {
      if (error instanceof Deno.errors.NotFound) {
        throw new Error(`Comment file not found: ${fileName}`);
      }
      throw error;
    },
  );
};
