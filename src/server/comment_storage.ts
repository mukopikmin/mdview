import type {
  PreviewComment,
  PreviewCommentsDocument,
} from "./comment_types.ts";

export const getCommentsFilePath = (markdownFilePath: string): string =>
  `${markdownFilePath}.mdview-comments.json`;

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

const normalizePreviewComment = (comment: PreviewComment): PreviewComment => ({
  ...comment,
  resolved: comment.resolved === true,
});

export const readCommentsDocument = async (
  filePath: string,
): Promise<PreviewCommentsDocument> => {
  const commentsFilePath = getCommentsFilePath(filePath);
  const text = await Deno.readTextFile(commentsFilePath).catch((error) => {
    if (error instanceof Deno.errors.NotFound) return undefined;
    throw error;
  });
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
  await Deno.writeTextFile(
    getCommentsFilePath(filePath),
    `${JSON.stringify(document, null, 2)}\n`,
  );
};
