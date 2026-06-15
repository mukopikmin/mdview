import type {
  PreviewComment,
  PreviewCommentReply,
  PreviewCommentsDocument,
} from "./types.ts";
import { basename, join } from "@std/path";

const commentsDirectoryName = "mdview";

const hashFilePath = (filePath: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < filePath.length; index += 1) {
    hash ^= filePath.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const sanitizeFileNamePart = (value: string): string =>
  value.replace(/[^A-Za-z0-9._-]/g, "_") || "markdown";

const getEnv = (name: string): string | undefined => {
  try {
    return Deno.env.get(name);
  } catch (error) {
    if (error instanceof Deno.errors.PermissionDenied) {
      throw new Error(
        `Cannot determine comments directory without environment access. Allow HOME, XDG_DATA_HOME, APPDATA, and MDVIEW_COMMENTS_DIR.`,
      );
    }
    throw error;
  }
};

export const getCommentsDirectoryPath = (): string => {
  const configuredDirectory = getEnv("MDVIEW_COMMENTS_DIR");
  if (configuredDirectory) return configuredDirectory;

  if (Deno.build.os === "darwin") {
    const home = getEnv("HOME");
    if (home) {
      return join(
        home,
        "Library",
        "Application Support",
        commentsDirectoryName,
        "comments",
      );
    }
  }

  if (Deno.build.os === "windows") {
    const appData = getEnv("APPDATA");
    if (appData) return join(appData, commentsDirectoryName, "comments");
  }

  const xdgDataHome = getEnv("XDG_DATA_HOME");
  if (xdgDataHome) return join(xdgDataHome, commentsDirectoryName, "comments");

  const home = getEnv("HOME");
  if (home) {
    return join(home, ".local", "share", commentsDirectoryName, "comments");
  }

  return join(Deno.cwd(), ".mdview", "comments");
};

export const getLegacyCommentsFilePath = (markdownFilePath: string): string =>
  `${markdownFilePath}.mdview-comments.json`;

export const getCommentsFilePath = (markdownFilePath: string): string => {
  const fileName = `${sanitizeFileNamePart(basename(markdownFilePath))}-${
    hashFilePath(markdownFilePath)
  }.json`;
  return join(getCommentsDirectoryPath(), fileName);
};

const createEmptyCommentsDocument = (
  filePath: string,
): PreviewCommentsDocument => ({
  comments: [],
  filePath,
});

const isPreviewComment = (value: unknown): value is PreviewComment => {
  if (typeof value !== "object" || value === null) return false;
  const comment = value as Partial<PreviewComment>;
  return typeof comment.id === "string" &&
    Number.isInteger(comment.line) &&
    typeof comment.body === "string" &&
    typeof comment.createdAt === "string" &&
    typeof comment.updatedAt === "string";
};

const isPreviewCommentReply = (
  value: unknown,
): value is PreviewCommentReply => {
  if (typeof value !== "object" || value === null) return false;
  const reply = value as Partial<PreviewCommentReply>;
  return typeof reply.id === "string" &&
    typeof reply.body === "string" &&
    typeof reply.createdAt === "string" &&
    typeof reply.updatedAt === "string";
};

const normalizePreviewComment = (comment: PreviewComment): PreviewComment => ({
  ...comment,
  replies: Array.isArray(comment.replies)
    ? comment.replies.filter(isPreviewCommentReply)
    : [],
  resolved: comment.resolved === true,
});

export const readCommentsDocument = async (
  filePath: string,
): Promise<PreviewCommentsDocument> => {
  const commentsFilePath = getCommentsFilePath(filePath);
  const text = await Deno.readTextFile(commentsFilePath).catch(
    async (error) => {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
      return await Deno.readTextFile(getLegacyCommentsFilePath(filePath)).catch(
        (legacyError) => {
          if (legacyError instanceof Deno.errors.NotFound) return undefined;
          throw legacyError;
        },
      );
    },
  );
  if (text === undefined) return createEmptyCommentsDocument(filePath);

  const parsed = JSON.parse(text) as Partial<PreviewCommentsDocument>;
  if (!Array.isArray(parsed.comments)) {
    return createEmptyCommentsDocument(filePath);
  }

  return {
    comments: parsed.comments.filter(isPreviewComment).map(
      normalizePreviewComment,
    ),
    filePath,
  };
};

export const writeCommentsDocument = async (
  filePath: string,
  document: PreviewCommentsDocument,
): Promise<void> => {
  await Deno.mkdir(getCommentsDirectoryPath(), { recursive: true });
  await Deno.writeTextFile(
    getCommentsFilePath(filePath),
    `${JSON.stringify(document, null, 2)}\n`,
  );
};
