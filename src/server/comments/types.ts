export type PreviewCommentReply = {
  body: string;
  createdAt: string;
  id: string;
  updatedAt: string;
};

export type PreviewComment = {
  body: string;
  createdAt: string;
  displayLine?: number;
  id: string;
  line: number;
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
