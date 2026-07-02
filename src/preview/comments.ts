export type PreviewCommentReply = {
  body: string;
  createdAt: string;
  id: string;
  updatedAt: string;
};

export type PreviewComment = {
  body: string;
  createdAt: string;
  endLine?: number;
  id: string;
  line: number;
  originalEndLine?: number;
  originalLine: number;
  replies?: PreviewCommentReply[];
  resolved: boolean;
  resolvedAt?: string;
  sourceHash?: string;
  sourceText?: string;
  stale: boolean;
  updatedAt: string;
};

export type PreviewCommentsDocument = {
  comments: PreviewComment[];
  filePath: string;
};

export const loadComments = async (): Promise<PreviewCommentsDocument> => {
  const response = await fetch("/__sadoku/comments");
  if (!response.ok) {
    throw new Error(`Failed to load comments: ${response.status}`);
  }
  return await response.json() as PreviewCommentsDocument;
};

export const createComment = async (
  line: number,
  body: string,
  endLine?: number,
): Promise<PreviewComment> => {
  const response = await fetch("/__sadoku/comments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ line, body, ...(endLine ? { endLine } : {}) }),
  });
  if (!response.ok) {
    throw new Error(`Failed to create comment: ${response.status}`);
  }
  return await response.json() as PreviewComment;
};

export const createReply = async (
  commentId: string,
  body: string,
): Promise<PreviewComment> => {
  const response = await fetch(
    `/__sadoku/comments/${encodeURIComponent(commentId)}/replies`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to create reply: ${response.status}`);
  }
  return await response.json() as PreviewComment;
};

export const updateReply = async (
  commentId: string,
  replyId: string,
  body: string,
): Promise<PreviewComment> => {
  const response = await fetch(
    `/__sadoku/comments/${encodeURIComponent(commentId)}/replies/${
      encodeURIComponent(replyId)
    }`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to update reply: ${response.status}`);
  }
  return await response.json() as PreviewComment;
};

export const deleteReply = async (
  commentId: string,
  replyId: string,
): Promise<void> => {
  const response = await fetch(
    `/__sadoku/comments/${encodeURIComponent(commentId)}/replies/${
      encodeURIComponent(replyId)
    }`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    throw new Error(`Failed to delete reply: ${response.status}`);
  }
};

export const updateComment = async (
  id: string,
  body: string,
): Promise<PreviewComment> => {
  const response = await fetch(`/__sadoku/comments/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ body }),
  });
  if (!response.ok) {
    throw new Error(`Failed to update comment: ${response.status}`);
  }
  return await response.json() as PreviewComment;
};

export const resolveComment = async (id: string): Promise<PreviewComment> => {
  const response = await fetch(
    `/__sadoku/comments/${encodeURIComponent(id)}/resolve`,
    {
      method: "POST",
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to resolve comment: ${response.status}`);
  }
  return await response.json() as PreviewComment;
};

export const reopenComment = async (id: string): Promise<PreviewComment> => {
  const response = await fetch(
    `/__sadoku/comments/${encodeURIComponent(id)}/reopen`,
    {
      method: "POST",
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to reopen comment: ${response.status}`);
  }
  return await response.json() as PreviewComment;
};

export const deleteComment = async (id: string): Promise<void> => {
  const response = await fetch(`/__sadoku/comments/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Failed to delete comment: ${response.status}`);
  }
};
