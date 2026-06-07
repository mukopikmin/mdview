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

const getCommentsFilePath = (markdownFilePath: string): string =>
  `${markdownFilePath}.mdview-comments.json`;

const lineSearchRadius = 40;

const getMarkdownLines = (markdown: string): string[] => markdown.split("\n");

const getLineText = (markdown: string, line: number): string | undefined =>
  getMarkdownLines(markdown)[line - 1];

const hashSourceText = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

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

const readCommentsDocument = async (
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

const resolveCommentPosition = (
  comment: PreviewComment,
  markdown: string,
): PreviewComment => {
  const sourceText = comment.sourceText ??
    getLineText(markdown, comment.line) ??
    "";
  const sourceHash = comment.sourceHash ?? hashSourceText(sourceText);
  const currentLineText = getLineText(markdown, comment.line);

  if (
    currentLineText !== undefined &&
    currentLineText === sourceText &&
    hashSourceText(currentLineText) === sourceHash
  ) {
    return {
      ...comment,
      originalLine: comment.line,
      sourceHash,
      sourceText,
      stale: false,
    };
  }

  const lines = getMarkdownLines(markdown);
  const startLine = Math.max(1, comment.line - lineSearchRadius);
  const endLine = Math.min(lines.length, comment.line + lineSearchRadius);
  const matchingLines: number[] = [];

  for (let line = startLine; line <= endLine; line += 1) {
    const lineText = lines[line - 1];
    if (lineText === sourceText && hashSourceText(lineText) === sourceHash) {
      matchingLines.push(line);
    }
  }

  if (matchingLines.length === 1) {
    return {
      ...comment,
      line: matchingLines[0],
      originalLine: comment.line,
      sourceHash,
      sourceText,
      stale: false,
    };
  }

  return {
    ...comment,
    originalLine: comment.line,
    sourceHash,
    sourceText,
    stale: true,
  };
};

const readResolvedCommentsDocument = async (
  filePath: string,
): Promise<PreviewCommentsDocument> => {
  const [document, markdown] = await Promise.all([
    readCommentsDocument(filePath),
    Deno.readTextFile(filePath),
  ]);
  return {
    comments: document.comments.map((comment) =>
      resolveCommentPosition(comment, markdown)
    ),
    filePath,
  };
};

const writeCommentsDocument = async (
  filePath: string,
  document: PreviewCommentsDocument,
): Promise<void> => {
  await Deno.writeTextFile(
    getCommentsFilePath(filePath),
    `${JSON.stringify(document, null, 2)}\n`,
  );
};

const parseJsonBody = async (request: Request): Promise<unknown> => {
  try {
    return await request.json();
  } catch {
    throw new Response("Invalid JSON body.", {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
};

const parseCommentBody = (value: unknown): string => {
  if (typeof value !== "object" || value === null) {
    throw new Response("Comment body is required.", {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  const body = (value as { body?: unknown }).body;
  if (typeof body !== "string" || body.trim() === "") {
    throw new Response("Comment body is required.", {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return body.trim();
};

const parseCommentLine = (value: unknown): number => {
  if (typeof value !== "object" || value === null) {
    throw new Response("Comment line is required.", {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  const line = (value as { line?: unknown }).line;
  if (typeof line !== "number" || !Number.isInteger(line) || line < 1) {
    throw new Response("Comment line must be a positive integer.", {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return line;
};

const createCommentResponse = (comment: PreviewComment): Response =>
  Response.json(comment, {
    headers: { "cache-control": "no-store" },
  });

const createCommentNotFoundResponse = (): Response =>
  new Response("Comment not found.", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });

export const handleCommentsRequest = async (
  request: Request,
  filePath: string,
  pathname: string,
): Promise<Response> => {
  const commentsPath = "/__mdview/comments";
  if (pathname === commentsPath && request.method === "GET") {
    return Response.json(await readResolvedCommentsDocument(filePath), {
      headers: { "cache-control": "no-store" },
    });
  }

  if (pathname === commentsPath && request.method === "POST") {
    const body = await parseJsonBody(request);
    const line = parseCommentLine(body);
    const commentBody = parseCommentBody(body);
    const markdown = await Deno.readTextFile(filePath);
    const sourceText = getLineText(markdown, line);
    if (sourceText === undefined) {
      throw new Response("Comment line does not exist.", {
        status: 400,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    const now = new Date().toISOString();
    const comment: PreviewComment = {
      body: commentBody,
      createdAt: now,
      id: crypto.randomUUID(),
      line,
      originalLine: line,
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
  }

  if (!pathname.startsWith(`${commentsPath}/`)) {
    return new Response("Not found.", { status: 404 });
  }

  const id = decodeURIComponent(pathname.slice(`${commentsPath}/`.length));
  if (id === "") return createCommentNotFoundResponse();

  const actionSeparator = id.indexOf("/");
  const commentId = actionSeparator === -1 ? id : id.slice(0, actionSeparator);
  const action = actionSeparator === -1
    ? undefined
    : id.slice(actionSeparator + 1);
  if (commentId === "") return createCommentNotFoundResponse();

  if (
    request.method === "POST" && (action === "resolve" || action === "reopen")
  ) {
    const document = await readCommentsDocument(filePath);
    const index = document.comments.findIndex((comment) =>
      comment.id === commentId
    );
    if (index < 0) return createCommentNotFoundResponse();
    const now = new Date().toISOString();
    const updatedComment = {
      ...document.comments[index],
      resolved: action === "resolve",
      resolvedAt: action === "resolve" ? now : undefined,
      updatedAt: now,
    };
    const comments = [...document.comments];
    comments[index] = updatedComment;
    await writeCommentsDocument(filePath, { comments, filePath });
    return createCommentResponse(
      resolveCommentPosition(updatedComment, await Deno.readTextFile(filePath)),
    );
  }

  if (action !== undefined) {
    return new Response("Not found.", { status: 404 });
  }

  if (request.method === "PUT") {
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
  }

  if (request.method === "DELETE") {
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
  }

  return new Response("Method not allowed.", {
    status: 405,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
