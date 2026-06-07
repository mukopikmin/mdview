export type PreviewComment = {
  body: string;
  createdAt: string;
  id: string;
  line: number;
  originalLine: number;
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
