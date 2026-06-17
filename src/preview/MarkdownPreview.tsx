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
import { CommentItem } from "./CommentItem";
import type { PreviewComment } from "./comments";

export type MarkdownPreviewProps = {
  comments: PreviewComment[];
  markdown: string;
  onCreateComment: (line: number, body: string) => Promise<void>;
  onDeleteComment: (id: string) => Promise<void>;
  onDeleteReply: (commentId: string, replyId: string) => Promise<void>;
  onReplyComment: (id: string, body: string) => Promise<void>;
  onResolveComment: (id: string) => Promise<void>;
  onUpdateComment: (id: string, body: string) => Promise<void>;
  onUpdateReply: (
    commentId: string,
    replyId: string,
    body: string,
  ) => Promise<void>;
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
  onDeleteReply: (commentId: string, replyId: string) => Promise<void>;
  onReplyComment: (id: string, body: string) => Promise<void>;
  onResolveComment: (id: string) => Promise<void>;
  onUpdateComment: (id: string, body: string) => Promise<void>;
  onUpdateReply: (
    commentId: string,
    replyId: string,
    body: string,
  ) => Promise<void>;
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
  onDeleteReply,
  onReplyComment,
  onResolveComment,
  onUpdateComment,
  onUpdateReply,
}: CommentableBlockProps) => {
  const [draft, setDraft] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();
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
        <div className="comment-thread">
          {comments.map((comment) => (
            <CommentItem
              comment={comment}
              key={comment.id}
              lineLabel={`Line ${line}`}
              onDeleteComment={onDeleteComment}
              onDeleteReply={onDeleteReply}
              onReplyComment={onReplyComment}
              onResolveComment={onResolveComment}
              onUpdateComment={onUpdateComment}
              onUpdateReply={onUpdateReply}
            />
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
    | "onCreateComment"
    | "onDeleteComment"
    | "onDeleteReply"
    | "onReplyComment"
    | "onResolveComment"
    | "onUpdateComment"
    | "onUpdateReply"
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
        onDeleteReply={props.onDeleteReply}
        onReplyComment={props.onReplyComment}
        onResolveComment={props.onResolveComment}
        onUpdateComment={props.onUpdateComment}
        onUpdateReply={props.onUpdateReply}
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
    | "onCreateComment"
    | "onDeleteComment"
    | "onDeleteReply"
    | "onReplyComment"
    | "onResolveComment"
    | "onUpdateComment"
    | "onUpdateReply"
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
          onDeleteReply={props.onDeleteReply}
          onReplyComment={props.onReplyComment}
          onResolveComment={props.onResolveComment}
          onUpdateComment={props.onUpdateComment}
          onUpdateReply={props.onUpdateReply}
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
    | "onCreateComment"
    | "onDeleteComment"
    | "onDeleteReply"
    | "onReplyComment"
    | "onResolveComment"
    | "onUpdateComment"
    | "onUpdateReply"
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
        onDeleteReply={props.onDeleteReply}
        onReplyComment={props.onReplyComment}
        onResolveComment={props.onResolveComment}
        onUpdateComment={props.onUpdateComment}
        onUpdateReply={props.onUpdateReply}
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
  onDeleteReply,
  onReplyComment,
  onResolveComment,
  onUpdateComment,
  onUpdateReply,
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
      onDeleteReply,
      onReplyComment,
      onResolveComment,
      onUpdateComment,
      onUpdateReply,
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
  }, [
    commentsByLine,
    onCreateComment,
    onDeleteComment,
    onDeleteReply,
    onReplyComment,
    onResolveComment,
    onUpdateComment,
    onUpdateReply,
  ]);

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
