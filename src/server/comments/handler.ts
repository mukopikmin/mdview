import type { PreviewComment, PreviewCommentReply } from "./types.ts";
import type { PreviewSource } from "../source.ts";
import {
  getLineText,
  hashSourceText,
  readResolvedCommentsDocument,
  resolveCommentPosition,
} from "./position.ts";
import { type CommentsStore, fileCommentsStore } from "./storage.ts";
import { readMarkdownSource } from "../source.ts";
import {
  methodNotAllowedResponse,
  noStoreJson,
  notFoundResponse,
  textResponse,
} from "../responses.ts";

export type { PreviewComment, PreviewCommentsDocument } from "./types.ts";

const parseJsonBody = async (request: Request): Promise<unknown> => {
  try {
    return await request.json();
  } catch {
    throw textResponse("Invalid JSON body.", 400);
  }
};

const parseCommentBody = (value: unknown): string => {
  if (typeof value !== "object" || value === null) {
    throw textResponse("Comment body is required.", 400);
  }
  const body = (value as { body?: unknown }).body;
  if (typeof body !== "string" || body.trim() === "") {
    throw textResponse("Comment body is required.", 400);
  }
  return body.trim();
};

const parseCommentLine = (value: unknown): number => {
  if (typeof value !== "object" || value === null) {
    throw textResponse("Comment line is required.", 400);
  }
  const line = (value as { line?: unknown }).line;
  if (typeof line !== "number" || !Number.isInteger(line) || line < 1) {
    throw textResponse("Comment line must be a positive integer.", 400);
  }
  return line;
};

const createCommentResponse = (comment: PreviewComment): Response =>
  noStoreJson(comment);

const createCommentNotFoundResponse = (): Response =>
  notFoundResponse("Comment not found.");

const createReplyNotFoundResponse = (): Response =>
  notFoundResponse("Reply not found.");

const parseCommentRoute = (
  pathname: string,
  commentsPath: string,
): { action?: string; commentId: number | undefined } | undefined => {
  if (!pathname.startsWith(`${commentsPath}/`)) return undefined;

  const id = decodeURIComponent(pathname.slice(`${commentsPath}/`.length));
  if (id === "") return { commentId: undefined };

  const actionSeparator = id.indexOf("/");
  return {
    action: actionSeparator === -1 ? undefined : id.slice(actionSeparator + 1),
    commentId: Number(
      actionSeparator === -1 ? id : id.slice(0, actionSeparator),
    ),
  };
};

const getNextId = (ids: number[]): number => Math.max(0, ...ids) + 1;

const createComment = async (
  request: Request,
  source: PreviewSource,
  commentsStore: CommentsStore,
): Promise<Response> => {
  const body = await parseJsonBody(request);
  const line = parseCommentLine(body);
  const commentBody = parseCommentBody(body);
  const markdown = await readMarkdownSource(source.documentSource);
  const sourceText = getLineText(markdown, line);
  if (sourceText === undefined) {
    throw textResponse("Comment line does not exist.", 400);
  }
  const document = await commentsStore.read(source.commentSource);
  const now = new Date().toISOString();
  const comment: PreviewComment = {
    body: commentBody,
    createdAt: now,
    id: getNextId(document.comments.map((comment) => comment.id)),
    line,
    originalLine: line,
    replies: [],
    resolved: false,
    sourceHash: hashSourceText(sourceText),
    sourceText,
    stale: false,
    updatedAt: now,
  };
  const updatedDocument = {
    comments: [...document.comments, comment],
    filePath: source.commentSource,
  };
  await commentsStore.write(source.commentSource, updatedDocument);
  return createCommentResponse(comment);
};

const createReply = async (
  request: Request,
  source: PreviewSource,
  commentsStore: CommentsStore,
  commentId: number,
): Promise<Response> => {
  const document = await commentsStore.read(source.commentSource);
  const index = document.comments.findIndex((comment) =>
    comment.id === commentId
  );
  if (index < 0) return createCommentNotFoundResponse();

  const body = await parseJsonBody(request);
  const replyBody = parseCommentBody(body);
  const now = new Date().toISOString();
  const reply: PreviewCommentReply = {
    body: replyBody,
    createdAt: now,
    id: getNextId(
      (document.comments[index].replies ?? []).map((reply) => reply.id),
    ),
    updatedAt: now,
  };
  const updatedComment = {
    ...document.comments[index],
    replies: [...(document.comments[index].replies ?? []), reply],
    updatedAt: now,
  };
  const comments = [...document.comments];
  comments[index] = updatedComment;
  await commentsStore.write(source.commentSource, {
    comments,
    filePath: source.commentSource,
  });
  return createCommentResponse(
    resolveCommentPosition(
      updatedComment,
      await readMarkdownSource(source.documentSource),
    ),
  );
};

const updateReply = async (
  request: Request,
  source: PreviewSource,
  commentsStore: CommentsStore,
  commentId: number,
  replyId: number,
): Promise<Response> => {
  const body = await parseJsonBody(request);
  const replyBody = parseCommentBody(body);
  const document = await commentsStore.read(source.commentSource);
  const commentIndex = document.comments.findIndex((comment) =>
    comment.id === commentId
  );
  if (commentIndex < 0) return createCommentNotFoundResponse();

  const comment = document.comments[commentIndex];
  const replies = comment.replies ?? [];
  const replyIndex = replies.findIndex((reply) => reply.id === replyId);
  if (replyIndex < 0) return createReplyNotFoundResponse();

  const now = new Date().toISOString();
  const updatedReplies = [...replies];
  updatedReplies[replyIndex] = {
    ...updatedReplies[replyIndex],
    body: replyBody,
    updatedAt: now,
  };
  const updatedComment = {
    ...comment,
    replies: updatedReplies,
    updatedAt: now,
  };
  const comments = [...document.comments];
  comments[commentIndex] = updatedComment;
  await commentsStore.write(source.commentSource, {
    comments,
    filePath: source.commentSource,
  });
  return createCommentResponse(
    resolveCommentPosition(
      updatedComment,
      await readMarkdownSource(source.documentSource),
    ),
  );
};

const deleteReply = async (
  source: PreviewSource,
  commentsStore: CommentsStore,
  commentId: number,
  replyId: number,
): Promise<Response> => {
  const document = await commentsStore.read(source.commentSource);
  const commentIndex = document.comments.findIndex((comment) =>
    comment.id === commentId
  );
  if (commentIndex < 0) return createCommentNotFoundResponse();

  const comment = document.comments[commentIndex];
  const replies = comment.replies ?? [];
  const updatedReplies = replies.filter((reply) => reply.id !== replyId);
  if (updatedReplies.length === replies.length) {
    return createReplyNotFoundResponse();
  }

  const comments = [...document.comments];
  comments[commentIndex] = {
    ...comment,
    replies: updatedReplies,
    updatedAt: new Date().toISOString(),
  };
  await commentsStore.write(source.commentSource, {
    comments,
    filePath: source.commentSource,
  });
  return new Response(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  });
};

const setCommentResolution = async (
  source: PreviewSource,
  commentsStore: CommentsStore,
  commentId: number,
  resolved: boolean,
): Promise<Response> => {
  const document = await commentsStore.read(source.commentSource);
  const index = document.comments.findIndex((comment) =>
    comment.id === commentId
  );
  if (index < 0) return createCommentNotFoundResponse();
  const now = new Date().toISOString();
  const updatedComment = {
    ...document.comments[index],
    resolved,
    resolvedAt: resolved ? now : undefined,
    updatedAt: now,
  };
  const comments = [...document.comments];
  comments[index] = updatedComment;
  await commentsStore.write(source.commentSource, {
    comments,
    filePath: source.commentSource,
  });
  return createCommentResponse(
    resolveCommentPosition(
      updatedComment,
      await readMarkdownSource(source.documentSource),
    ),
  );
};

const updateComment = async (
  request: Request,
  source: PreviewSource,
  commentsStore: CommentsStore,
  commentId: number,
): Promise<Response> => {
  const body = await parseJsonBody(request);
  const commentBody = parseCommentBody(body);
  const document = await commentsStore.read(source.commentSource);
  const index = document.comments.findIndex((comment) =>
    comment.id === commentId
  );
  if (index < 0) return createCommentNotFoundResponse();
  const updatedComment = {
    ...document.comments[index],
    body: commentBody,
    updatedAt: new Date().toISOString(),
  };
  const comments = [...document.comments];
  comments[index] = updatedComment;
  await commentsStore.write(source.commentSource, {
    comments,
    filePath: source.commentSource,
  });
  return createCommentResponse(
    resolveCommentPosition(
      updatedComment,
      await readMarkdownSource(source.documentSource),
    ),
  );
};

const deleteComment = async (
  source: PreviewSource,
  commentsStore: CommentsStore,
  commentId: number,
): Promise<Response> => {
  const document = await commentsStore.read(source.commentSource);
  const comments = document.comments.filter((comment) =>
    comment.id !== commentId
  );
  if (comments.length === document.comments.length) {
    return createCommentNotFoundResponse();
  }
  await commentsStore.write(source.commentSource, {
    comments,
    filePath: source.commentSource,
  });
  return new Response(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  });
};

export const handleCommentsRequest = async (
  request: Request,
  source: PreviewSource,
  pathname: string,
  commentsStore: CommentsStore = fileCommentsStore,
): Promise<Response> => {
  const commentsPath = "/__sadoku/comments";
  if (pathname === commentsPath && request.method === "GET") {
    return noStoreJson(
      await readResolvedCommentsDocument(
        source.commentSource,
        source.documentSource,
        commentsStore,
      ),
    );
  }

  if (pathname === commentsPath && request.method === "POST") {
    return await createComment(request, source, commentsStore);
  }

  const route = parseCommentRoute(pathname, commentsPath);
  if (!route) return notFoundResponse();
  if (route.commentId === undefined || Number.isNaN(route.commentId)) {
    return createCommentNotFoundResponse();
  }

  if (
    request.method === "POST" &&
    (route.action === "resolve" || route.action === "reopen")
  ) {
    return await setCommentResolution(
      source,
      commentsStore,
      route.commentId,
      route.action === "resolve",
    );
  }

  if (request.method === "POST" && route.action === "replies") {
    return await createReply(request, source, commentsStore, route.commentId);
  }

  if (route.action?.startsWith("replies/")) {
    const replyId = Number(route.action.slice("replies/".length));
    if (Number.isNaN(replyId)) return createReplyNotFoundResponse();
    if (request.method === "PUT") {
      return await updateReply(
        request,
        source,
        commentsStore,
        route.commentId,
        replyId,
      );
    }
    if (request.method === "DELETE") {
      return await deleteReply(source, commentsStore, route.commentId, replyId);
    }
    return methodNotAllowedResponse();
  }

  if (route.action !== undefined) return notFoundResponse();
  if (request.method === "PUT") {
    return await updateComment(request, source, commentsStore, route.commentId);
  }
  if (request.method === "DELETE") {
    return await deleteComment(source, commentsStore, route.commentId);
  }

  return methodNotAllowedResponse();
};
