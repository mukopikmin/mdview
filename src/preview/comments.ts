export type PreviewCommentReply = {
  body: string;
  createdAt: string;
  id: number;
  updatedAt: string;
};

export type PreviewComment = {
  body: string;
  createdAt: string;
  id: number;
  line: number;
  endLine: number;
  originalLine: number;
  originalEndLine: number;
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
  endLine = line,
): Promise<PreviewComment> => {
  const response = await fetch("/__sadoku/comments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ line, endLine, body }),
  });
  if (!response.ok) {
    throw new Error(`Failed to create comment: ${response.status}`);
  }
  return await response.json() as PreviewComment;
};

export const createReply = async (
  commentId: number,
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
  commentId: number,
  replyId: number,
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
  commentId: number,
  replyId: number,
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
  id: number,
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

export const resolveComment = async (id: number): Promise<PreviewComment> => {
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

export const reopenComment = async (id: number): Promise<PreviewComment> => {
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

export const deleteComment = async (id: number): Promise<void> => {
  const response = await fetch(`/__sadoku/comments/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Failed to delete comment: ${response.status}`);
  }
};
