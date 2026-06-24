import type {
  PreviewComment,
  PreviewCommentReply,
  PreviewCommentsDocument,
} from "./types.ts";
import { basename, join } from "@std/path";
import { readConfig } from "../../config.ts";

const commentsDirectoryName = "sadoku";
const legacyCommentsDirectoryName = "mdview";

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
        `Cannot determine comments directory without environment access. Allow HOME, XDG_CONFIG_HOME, XDG_DATA_HOME, APPDATA, SADOKU_COMMENTS_DIR, and MDVIEW_COMMENTS_DIR.`,
      );
    }
    throw error;
  }
};

const getDefaultCommentsDirectoryPath = (directoryName: string): string => {
  if (Deno.build.os === "darwin") {
    const home = getEnv("HOME");
    if (home) {
      return join(
        home,
        "Library",
        "Application Support",
        directoryName,
        "comments",
      );
    }
  }

  if (Deno.build.os === "windows") {
    const appData = getEnv("APPDATA");
    if (appData) return join(appData, directoryName, "comments");
  }

  const xdgDataHome = getEnv("XDG_DATA_HOME");
  if (xdgDataHome) return join(xdgDataHome, directoryName, "comments");

  const home = getEnv("HOME");
  if (home) {
    return join(home, ".local", "share", directoryName, "comments");
  }

  return join(Deno.cwd(), `.${directoryName}`, "comments");
};

export const getCommentsDirectoryPath = (): string => {
  const configuredDirectory = getEnv("SADOKU_COMMENTS_DIR");
  if (configuredDirectory) return configuredDirectory;

  const config = readConfig();
  if (config?.commentsDirectory) return config.commentsDirectory;

  const legacyConfiguredDirectory = getEnv("MDVIEW_COMMENTS_DIR");
  if (legacyConfiguredDirectory) return legacyConfiguredDirectory;

  return getDefaultCommentsDirectoryPath(commentsDirectoryName);
};

const getLegacyCommentsDirectoryPath = (): string =>
  getDefaultCommentsDirectoryPath(legacyCommentsDirectoryName);

export const getLegacyCommentsFilePath = (markdownFilePath: string): string =>
  `${markdownFilePath}.mdview-comments.json`;

const getSadokuSidecarCommentsFilePath = (markdownFilePath: string): string =>
  `${markdownFilePath}.sadoku-comments.json`;

const getCommentsStorageFileName = (markdownFilePath: string): string =>
  `${sanitizeFileNamePart(basename(markdownFilePath))}-${
    hashFilePath(markdownFilePath)
  }.json`;

export const getCommentsFilePath = (markdownFilePath: string): string =>
  join(
    getCommentsDirectoryPath(),
    getCommentsStorageFileName(markdownFilePath),
  );

const getLegacyDirectoryCommentsFilePath = (markdownFilePath: string): string =>
  join(
    getLegacyCommentsDirectoryPath(),
    getCommentsStorageFileName(markdownFilePath),
  );

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
  const candidatePaths = [
    getCommentsFilePath(filePath),
    getSadokuSidecarCommentsFilePath(filePath),
    getLegacyDirectoryCommentsFilePath(filePath),
    getLegacyCommentsFilePath(filePath),
  ];
  let text: string | undefined;
  for (const candidatePath of candidatePaths) {
    text = await Deno.readTextFile(candidatePath).catch((error) => {
      if (error instanceof Deno.errors.NotFound) return undefined;
      throw error;
    });
    if (text !== undefined) break;
  }
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
