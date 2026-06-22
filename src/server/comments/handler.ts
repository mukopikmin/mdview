import type { PreviewComment, PreviewCommentReply } from "./types.ts";
import {
  getLineText,
  hashSourceText,
  readResolvedCommentsDocument,
  resolveCommentPosition,
} from "./position.ts";
import { readCommentsDocument, writeCommentsDocument } from "./storage.ts";
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
): { action?: string; commentId: string } | undefined => {
  if (!pathname.startsWith(`${commentsPath}/`)) return undefined;

  const id = decodeURIComponent(pathname.slice(`${commentsPath}/`.length));
  if (id === "") return { commentId: "" };

  const actionSeparator = id.indexOf("/");
  return {
    action: actionSeparator === -1 ? undefined : id.slice(actionSeparator + 1),
    commentId: actionSeparator === -1 ? id : id.slice(0, actionSeparator),
  };
};

const createComment = async (
  request: Request,
  filePath: string,
): Promise<Response> => {
  const body = await parseJsonBody(request);
  const line = parseCommentLine(body);
  const commentBody = parseCommentBody(body);
  const markdown = await Deno.readTextFile(filePath);
  const sourceText = getLineText(markdown, line);
  if (sourceText === undefined) {
    throw textResponse("Comment line does not exist.", 400);
  }
  const now = new Date().toISOString();
  const comment: PreviewComment = {
    body: commentBody,
    createdAt: now,
    id: crypto.randomUUID(),
    line,
    originalLine: line,
    replies: [],
    resolved: false,
    sourceHash: hashSourceText(sourceText),
    sourceText,
    stale: false,
    updatedAt: now,
  };
  const document = await readCommentsDocument(filePath);
  const updatedDocument = {
    comments: [...document.comments, comment],
    filePath,
  };
  await writeCommentsDocument(filePath, updatedDocument);
  return createCommentResponse(comment);
};

const createReply = async (
  request: Request,
  filePath: string,
  commentId: string,
): Promise<Response> => {
  const document = await readCommentsDocument(filePath);
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
  await writeCommentsDocument(filePath, { comments, filePath });
  return createCommentResponse(
    resolveCommentPosition(updatedComment, await Deno.readTextFile(filePath)),
  );
};

const updateReply = async (
  request: Request,
  filePath: string,
  commentId: string,
  replyId: string,
): Promise<Response> => {
  const body = await parseJsonBody(request);
  const replyBody = parseCommentBody(body);
  const document = await readCommentsDocument(filePath);
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
  await writeCommentsDocument(filePath, { comments, filePath });
  return createCommentResponse(
    resolveCommentPosition(updatedComment, await Deno.readTextFile(filePath)),
  );
};

const deleteReply = async (
  filePath: string,
  commentId: string,
  replyId: string,
): Promise<Response> => {
  const document = await readCommentsDocument(filePath);
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
  await writeCommentsDocument(filePath, { comments, filePath });
  return new Response(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  });
};

const setCommentResolution = async (
  filePath: string,
  commentId: string,
  resolved: boolean,
): Promise<Response> => {
  const document = await readCommentsDocument(filePath);
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
  await writeCommentsDocument(filePath, { comments, filePath });
  return createCommentResponse(
    resolveCommentPosition(updatedComment, await Deno.readTextFile(filePath)),
  );
};

const updateComment = async (
  request: Request,
  filePath: string,
  commentId: string,
): Promise<Response> => {
  const body = await parseJsonBody(request);
  const commentBody = parseCommentBody(body);
  const document = await readCommentsDocument(filePath);
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
  await writeCommentsDocument(filePath, { comments, filePath });
  return createCommentResponse(
    resolveCommentPosition(updatedComment, await Deno.readTextFile(filePath)),
  );
};

const deleteComment = async (
  filePath: string,
  commentId: string,
): Promise<Response> => {
  const document = await readCommentsDocument(filePath);
  const comments = document.comments.filter((comment) =>
    comment.id !== commentId
  );
  if (comments.length === document.comments.length) {
    return createCommentNotFoundResponse();
  }
  await writeCommentsDocument(filePath, { comments, filePath });
  return new Response(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  });
};

export const handleCommentsRequest = async (
  request: Request,
  filePath: string,
  pathname: string,
): Promise<Response> => {
  const commentsPath = "/__sadoku/comments";
  if (pathname === commentsPath && request.method === "GET") {
    return noStoreJson(await readResolvedCommentsDocument(filePath));
  }

  if (pathname === commentsPath && request.method === "POST") {
    return await createComment(request, filePath);
  }

  const route = parseCommentRoute(pathname, commentsPath);
  if (!route) return notFoundResponse();
  if (route.commentId === "") return createCommentNotFoundResponse();

  if (
    request.method === "POST" &&
    (route.action === "resolve" || route.action === "reopen")
  ) {
    return await setCommentResolution(
      filePath,
      route.commentId,
      route.action === "resolve",
    );
  }

  if (request.method === "POST" && route.action === "replies") {
    return await createReply(request, filePath, route.commentId);
  }

  if (route.action?.startsWith("replies/")) {
    const replyId = route.action.slice("replies/".length);
    if (replyId === "") return createReplyNotFoundResponse();
    if (request.method === "PUT") {
      return await updateReply(request, filePath, route.commentId, replyId);
    }
    if (request.method === "DELETE") {
      return await deleteReply(filePath, route.commentId, replyId);
    }
    return methodNotAllowedResponse();
  }

  if (route.action !== undefined) return notFoundResponse();
  if (request.method === "PUT") {
    return await updateComment(request, filePath, route.commentId);
  }
  if (request.method === "DELETE") {
    return await deleteComment(filePath, route.commentId);
  }

  return methodNotAllowedResponse();
};
