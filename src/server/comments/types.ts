export type PreviewCommentReply = {
  body: string;
  createdAt: string;
  id: number;
  updatedAt: string;
};

export type PreviewComment = {
  body: string;
  createdAt: string;
  displayLine?: number;
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
