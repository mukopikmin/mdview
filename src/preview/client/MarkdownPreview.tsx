import {
  Children,
  createContext,
  createElement,
  isValidElement,
  useContext,
  useMemo,
  useState,
} from "react";
import type React from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import type { PreviewComment } from "./comments";

export type MarkdownPreviewProps = {
  comments: PreviewComment[];
  markdown: string;
  onCreateComment: (line: number, body: string) => Promise<void>;
  onDeleteComment: (id: string) => Promise<void>;
  onUpdateComment: (id: string, body: string) => Promise<void>;
};

const trimFinalNewline = (value: string): string => value.replace(/\n$/, "");

const SourceLineContext = createContext<ReadonlySet<number>>(new Set());

type SourcePosition = {
  start?: {
    line?: number;
  };
};

type SourceNode = {
  position?: SourcePosition;
};

type CommentableBlockProps = {
  children: React.ReactNode;
  className?: string;
  comments: PreviewComment[];
  line: number;
  onCreateComment: (line: number, body: string) => Promise<void>;
  onDeleteComment: (id: string) => Promise<void>;
  onUpdateComment: (id: string, body: string) => Promise<void>;
};

const getSourceLine = (props: { node?: SourceNode }): number | undefined => {
  return props.node?.position?.start?.line;
};

const CommentableBlock = ({
  children,
  className,
  comments,
  line,
  onCreateComment,
  onDeleteComment,
  onUpdateComment,
}: CommentableBlockProps) => {
  const [draft, setDraft] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string>();
  const [editDraft, setEditDraft] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();
  const hasStaleComments = comments.some((comment) => comment.stale);
  const ancestorSourceLines = useContext(SourceLineContext);
  const sourceLines = useMemo(() => {
    return new Set([...ancestorSourceLines, line]);
  }, [ancestorSourceLines, line]);

  const handleCreate = async () => {
    const body = draft.trim();
    if (!body) return;
    setIsSaving(true);
    setError(undefined);
    try {
      await onCreateComment(line, body);
      setDraft("");
      setIsAdding(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    const body = editDraft.trim();
    if (!body) return;
    setIsSaving(true);
    setError(undefined);
    try {
      await onUpdateComment(id, body);
      setEditingCommentId(undefined);
      setEditDraft("");
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsSaving(true);
    setError(undefined);
    try {
      await onDeleteComment(id);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className={["commentable-block", className].filter(Boolean).join(" ")}
      data-source-line={line}
    >
      <div className="commentable-content">
        <button
          aria-label={`Add comment on line ${line}`}
          className="comment-line-button"
          onClick={() => setIsAdding((value) => !value)}
          title={`Comment on line ${line}`}
          type="button"
        >
        </button>
        <SourceLineContext.Provider value={sourceLines}>
          {children}
        </SourceLineContext.Provider>
      </div>
      {(isAdding || comments.length > 0 || error) && (
        <div
          className={hasStaleComments
            ? "comment-thread comment-thread-stale"
            : "comment-thread"}
        >
          <div className="comment-thread-heading">
            Line {line}
            {hasStaleComments && <span>Stale</span>}
          </div>
          {comments.map((comment) => (
            <div className="comment-item" key={comment.id}>
              {editingCommentId === comment.id
                ? (
                  <>
                    <textarea
                      className="comment-input"
                      onChange={(event) => setEditDraft(event.target.value)}
                      value={editDraft}
                    />
                    <div className="comment-actions">
                      <button
                        disabled={isSaving}
                        onClick={() =>
                          handleUpdate(comment.id)}
                        type="button"
                      >
                        Save
                      </button>
                      <button
                        disabled={isSaving}
                        onClick={() =>
                          setEditingCommentId(undefined)}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )
                : (
                  <>
                    {comment.stale && (
                      <div className="comment-stale-source">
                        Originally line {comment.originalLine}:{" "}
                        <code>{comment.sourceText ?? ""}</code>
                      </div>
                    )}
                    <div className="comment-body">{comment.body}</div>
                    <div className="comment-actions">
                      <button
                        disabled={isSaving}
                        onClick={() => {
                          setEditingCommentId(comment.id);
                          setEditDraft(comment.body);
                        }}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        disabled={isSaving}
                        onClick={() => handleDelete(comment.id)}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
            </div>
          ))}
          {isAdding && (
            <div className="comment-form">
              <textarea
                className="comment-input"
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Write a GitHub PR comment..."
                value={draft}
              />
              <div className="comment-actions">
                <button
                  disabled={isSaving || draft.trim() === ""}
                  onClick={handleCreate}
                  type="button"
                >
                  Add comment
                </button>
                <button
                  disabled={isSaving}
                  onClick={() => setIsAdding(false)}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {error && <div className="comment-error">{error}</div>}
        </div>
      )}
    </div>
  );
};

type ComponentProps = {
  children?: React.ReactNode;
  node?: SourceNode;
};

type CodeElementProps = {
  children?: React.ReactNode;
  className?: string;
};

const getMermaidCodeText = (
  children: React.ReactNode,
): string | undefined => {
  const childElements = Children.toArray(children);
  if (childElements.length !== 1) return undefined;
  const child = childElements[0];
  if (!isValidElement<CodeElementProps>(child)) return undefined;
  const className = child.props.className;
  if (!className?.match(/\blanguage-mermaid\b/)) return undefined;

  return trimFinalNewline(String(child.props.children));
};

const createCommentableComponent = (
  tagName: keyof React.JSX.IntrinsicElements,
  commentsByLine: Map<number, PreviewComment[]>,
  props: Pick<
    MarkdownPreviewProps,
    "onCreateComment" | "onDeleteComment" | "onUpdateComment"
  >,
) => {
  return ({ children, node, ...elementProps }: ComponentProps) => {
    const ancestorSourceLines = useContext(SourceLineContext);
    const line = getSourceLine({ node });
    const element = createElement(tagName, elementProps, children);
    if (line === undefined) return element;
    if (ancestorSourceLines.has(line)) return element;

    return (
      <CommentableBlock
        comments={commentsByLine.get(line) ?? []}
        line={line}
        onCreateComment={props.onCreateComment}
        onDeleteComment={props.onDeleteComment}
        onUpdateComment={props.onUpdateComment}
      >
        {element}
      </CommentableBlock>
    );
  };
};

const createCommentableListItem = (
  commentsByLine: Map<number, PreviewComment[]>,
  props: Pick<
    MarkdownPreviewProps,
    "onCreateComment" | "onDeleteComment" | "onUpdateComment"
  >,
) => {
  return ({ children, node, ...elementProps }: ComponentProps) => {
    const ancestorSourceLines = useContext(SourceLineContext);
    const line = getSourceLine({ node });
    if (line === undefined) return <li {...elementProps}>{children}</li>;
    if (ancestorSourceLines.has(line)) {
      return <li {...elementProps}>{children}</li>;
    }

    return (
      <li {...elementProps}>
        <CommentableBlock
          className="commentable-list-item"
          comments={commentsByLine.get(line) ?? []}
          line={line}
          onCreateComment={props.onCreateComment}
          onDeleteComment={props.onDeleteComment}
          onUpdateComment={props.onUpdateComment}
        >
          {children}
        </CommentableBlock>
      </li>
    );
  };
};

const createCommentablePre = (
  commentsByLine: Map<number, PreviewComment[]>,
  props: Pick<
    MarkdownPreviewProps,
    "onCreateComment" | "onDeleteComment" | "onUpdateComment"
  >,
) => {
  return ({ children, node, ...elementProps }: ComponentProps) => {
    const ancestorSourceLines = useContext(SourceLineContext);
    const line = getSourceLine({ node });
    const mermaidCode = getMermaidCodeText(children);
    const element = mermaidCode === undefined
      ? <pre {...elementProps}>{children}</pre>
      : <pre className="mermaid">{mermaidCode}</pre>;
    if (line === undefined) return element;
    if (ancestorSourceLines.has(line)) return element;

    return (
      <CommentableBlock
        comments={commentsByLine.get(line) ?? []}
        line={line}
        onCreateComment={props.onCreateComment}
        onDeleteComment={props.onDeleteComment}
        onUpdateComment={props.onUpdateComment}
      >
        {element}
      </CommentableBlock>
    );
  };
};

export const MarkdownPreview = ({
  comments,
  markdown,
  onCreateComment,
  onDeleteComment,
  onUpdateComment,
}: MarkdownPreviewProps) => {
  const commentsByLine = useMemo(() => {
    const grouped = new Map<number, PreviewComment[]>();
    for (const comment of comments) {
      grouped.set(comment.line, [
        ...(grouped.get(comment.line) ?? []),
        comment,
      ]);
    }
    return grouped;
  }, [comments]);

  const components = useMemo<Components>(() => {
    const commentCallbacks = {
      onCreateComment,
      onDeleteComment,
      onUpdateComment,
    };
    return {
      h1: createCommentableComponent("h1", commentsByLine, commentCallbacks),
      h2: createCommentableComponent("h2", commentsByLine, commentCallbacks),
      h3: createCommentableComponent("h3", commentsByLine, commentCallbacks),
      h4: createCommentableComponent("h4", commentsByLine, commentCallbacks),
      h5: createCommentableComponent("h5", commentsByLine, commentCallbacks),
      h6: createCommentableComponent("h6", commentsByLine, commentCallbacks),
      li: createCommentableListItem(commentsByLine, commentCallbacks),
      p: createCommentableComponent("p", commentsByLine, commentCallbacks),
      pre: createCommentablePre(commentsByLine, commentCallbacks),
      table: createCommentableComponent(
        "table",
        commentsByLine,
        commentCallbacks,
      ),
      code({ children, className, ...props }) {
        return (
          <code className={className} {...props}>
            {children}
          </code>
        );
      },
    };
  }, [commentsByLine, onCreateComment, onDeleteComment, onUpdateComment]);

  return (
    <ReactMarkdown
      components={components}
      rehypePlugins={[
        rehypeSlug,
        [rehypeAutolinkHeadings, {
          behavior: "wrap",
          properties: { className: "heading-anchor" },
        }],
        rehypeHighlight,
      ]}
      remarkPlugins={[remarkGfm]}
    >
      {markdown}
    </ReactMarkdown>
  );
};
