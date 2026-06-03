export type PreviewComment = {
  body: string;
  createdAt: string;
  id: string;
  line: number;
  updatedAt: string;
};

export type PreviewCommentsDocument = {
  comments: PreviewComment[];
  filePath: string;
};

export const loadComments = async (): Promise<PreviewCommentsDocument> => {
  const response = await fetch("/__mdview/comments");
  if (!response.ok) {
    throw new Error(`Failed to load comments: ${response.status}`);
  }
  return await response.json() as PreviewCommentsDocument;
};

export const createComment = async (
  line: number,
  body: string,
): Promise<PreviewComment> => {
  const response = await fetch("/__mdview/comments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ line, body }),
  });
  if (!response.ok) {
    throw new Error(`Failed to create comment: ${response.status}`);
  }
  return await response.json() as PreviewComment;
};

export const updateComment = async (
  id: string,
  body: string,
): Promise<PreviewComment> => {
  const response = await fetch(`/__mdview/comments/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ body }),
  });
  if (!response.ok) {
    throw new Error(`Failed to update comment: ${response.status}`);
  }
  return await response.json() as PreviewComment;
};

export const deleteComment = async (id: string): Promise<void> => {
  const response = await fetch(`/__mdview/comments/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Failed to delete comment: ${response.status}`);
  }
};
