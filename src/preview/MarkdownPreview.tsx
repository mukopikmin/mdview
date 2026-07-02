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
import { submitCommentOnShortcut } from "./commentShortcuts";
import { CommentItem } from "./CommentItem";
import type { PreviewComment } from "./comments";

export type MarkdownPreviewProps = {
  comments: PreviewComment[];
  markdown: string;
  onCreateComment: (
    line: number,
    body: string,
    endLine?: number,
  ) => Promise<void>;
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
  activeRange?: CommentRange;
  children: React.ReactNode;
  className?: string;
  comments: PreviewComment[];
  isAdding: boolean;
  isRangeActionLine: boolean;
  isSelected: boolean;
  line: number;
  onCreateComment: (
    line: number,
    body: string,
    endLine?: number,
  ) => Promise<void>;
  onCloseCommentForm: () => void;
  onDeleteComment: (id: string) => Promise<void>;
  onDeleteReply: (commentId: string, replyId: string) => Promise<void>;
  onOpenCommentForm: () => void;
  onSelectCommentLine: (line: number) => void;
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

type CommentRange = { endLine: number; line: number };

const isLineInRange = (line: number, range: CommentRange): boolean =>
  line >= range.line && line <= range.endLine;

const formatRangeLabel = (range: CommentRange): string =>
  range.line === range.endLine
    ? `line ${range.line}`
    : `lines ${range.line}-${range.endLine}`;

const CommentableBlock = ({
  activeRange,
  children,
  className,
  comments,
  isAdding,
  isRangeActionLine,
  isSelected,
  line,
  onCreateComment,
  onCloseCommentForm,
  onDeleteComment,
  onDeleteReply,
  onOpenCommentForm,
  onSelectCommentLine,
  onReplyComment,
  onResolveComment,
  onUpdateComment,
  onUpdateReply,
}: CommentableBlockProps) => {
  const [draft, setDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const pendingRange = activeRange ?? {
    endLine: line,
    line,
  };
  const [error, setError] = useState<string>();
  const ancestorSourceLines = useContext(SourceLineContext);
  const sourceLines = useMemo(() => {
    return new Set([...ancestorSourceLines, line]);
  }, [ancestorSourceLines, line]);

  const handleCreate = async () => {
    const body = draft.trim();
    if (!body || isSaving) return;
    setIsSaving(true);
    setError(undefined);
    try {
      await onCreateComment(pendingRange.line, body, pendingRange.endLine);
      setDraft("");
      onCloseCommentForm();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleContentClick = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("button, input, label, select, textarea")) return;

    const link = target.closest("a");
    if (link && !link.classList.contains("heading-anchor")) return;
    if (link) event.preventDefault();

    onSelectCommentLine(line);
  };

  return (
    <div
      className={[
        "commentable-block",
        isSelected ? "commentable-block-selected" : undefined,
        className,
      ].filter(Boolean).join(" ")}
      data-source-line={line}
    >
      <div
        className="commentable-content"
        onClick={handleContentClick}
        title={`Select line ${line} for comment`}
      >
        <div className="comment-markdown-body">
          {isRangeActionLine && !isAdding && (
            <button
              className="comment-selection-button"
              onClick={onOpenCommentForm}
              type="button"
            >
              Add comment
            </button>
          )}
          <SourceLineContext.Provider value={sourceLines}>
            {children}
          </SourceLineContext.Provider>
        </div>
      </div>
      {(isAdding || comments.length > 0 || error) && (
        <div className="comment-thread">
          {comments.map((comment) => (
            <CommentItem
              comment={comment}
              key={comment.id}
              lineLabel={comment.line === (comment.endLine ?? comment.line)
                ? `Line ${comment.line}`
                : `Lines ${comment.line}-${comment.endLine}`}
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
              <div className="comment-range-hint">
                Commenting on {formatRangeLabel(pendingRange)}.
              </div>
              <textarea
                autoFocus
                className="comment-input"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) =>
                  submitCommentOnShortcut(event, () => {
                    void handleCreate();
                  })}
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
                  onClick={() => {
                    onCloseCommentForm();
                  }}
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

type CommentControlProps =
  & Pick<
    MarkdownPreviewProps,
    | "onCreateComment"
    | "onDeleteComment"
    | "onDeleteReply"
    | "onReplyComment"
    | "onResolveComment"
    | "onUpdateComment"
    | "onUpdateReply"
  >
  & {
    activeCommentLine?: number;
    activeRange?: CommentRange;
    onCloseCommentForm: () => void;
    onOpenCommentForm: () => void;
    onSelectCommentLine: (line: number) => void;
    selectedRange?: CommentRange;
  };

const createCommentableComponent = (
  tagName: keyof React.JSX.IntrinsicElements,
  commentsByLine: Map<number, PreviewComment[]>,
  props: CommentControlProps,
) => {
  return ({ children, node, ...elementProps }: ComponentProps) => {
    const ancestorSourceLines = useContext(SourceLineContext);
    const line = getSourceLine({ node });
    const element = createElement(tagName, elementProps, children);
    if (line === undefined) return element;
    if (ancestorSourceLines.has(line)) return element;

    return (
      <CommentableBlock
        activeRange={props.activeRange}
        comments={commentsByLine.get(line) ?? []}
        isAdding={props.activeCommentLine === line}
        isRangeActionLine={props.selectedRange?.endLine === line}
        isSelected={props.selectedRange
          ? isLineInRange(line, props.selectedRange)
          : false}
        line={line}
        onCloseCommentForm={props.onCloseCommentForm}
        onCreateComment={props.onCreateComment}
        onDeleteComment={props.onDeleteComment}
        onDeleteReply={props.onDeleteReply}
        onOpenCommentForm={props.onOpenCommentForm}
        onSelectCommentLine={props.onSelectCommentLine}
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
  props: CommentControlProps,
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
          activeRange={props.activeRange}
          className="commentable-list-item"
          comments={commentsByLine.get(line) ?? []}
          isAdding={props.activeCommentLine === line}
          isRangeActionLine={props.selectedRange?.endLine === line}
          isSelected={props.selectedRange
            ? isLineInRange(line, props.selectedRange)
            : false}
          line={line}
          onCloseCommentForm={props.onCloseCommentForm}
          onCreateComment={props.onCreateComment}
          onDeleteComment={props.onDeleteComment}
          onDeleteReply={props.onDeleteReply}
          onOpenCommentForm={props.onOpenCommentForm}
          onSelectCommentLine={props.onSelectCommentLine}
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
  props: CommentControlProps,
) => {
  return ({ children, node, ...elementProps }: ComponentProps) => {
    const ancestorSourceLines = useContext(SourceLineContext);
    const line = getSourceLine({ node });
    const mermaidCode = getMermaidCodeText(children);
    const element = mermaidCode === undefined
      ? <pre {...elementProps}>{children}</pre>
      : (
        <div className="mermaid-container">
          <pre className="mermaid">{mermaidCode}</pre>
          <button
            aria-label="Zoom Mermaid diagram"
            className="mermaid-zoom-button"
            title="Zoom Mermaid diagram"
            type="button"
          >
            Zoom
          </button>
        </div>
      );
    if (line === undefined) return element;
    if (ancestorSourceLines.has(line)) return element;

    return (
      <CommentableBlock
        activeRange={props.activeRange}
        comments={commentsByLine.get(line) ?? []}
        isAdding={props.activeCommentLine === line}
        isRangeActionLine={props.selectedRange?.endLine === line}
        isSelected={props.selectedRange
          ? isLineInRange(line, props.selectedRange)
          : false}
        line={line}
        onCloseCommentForm={props.onCloseCommentForm}
        onCreateComment={props.onCreateComment}
        onDeleteComment={props.onDeleteComment}
        onDeleteReply={props.onDeleteReply}
        onOpenCommentForm={props.onOpenCommentForm}
        onSelectCommentLine={props.onSelectCommentLine}
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
      const displayLine = comment.endLine ?? comment.line;
      grouped.set(displayLine, [
        ...(grouped.get(displayLine) ?? []),
        comment,
      ]);
    }
    return grouped;
  }, [comments]);

  const [activeCommentLine, setActiveCommentLine] = useState<number>();
  const [activeRange, setActiveRange] = useState<CommentRange>();
  const [lineSelectionAnchor, setLineSelectionAnchor] = useState<number>();
  const [selectedRange, setSelectedRange] = useState<CommentRange>();

  const handleSelectCommentLine = (line: number) => {
    setActiveCommentLine(undefined);
    setActiveRange(undefined);
    setSelectedRange((current) => {
      if (current && isLineInRange(line, current)) {
        setLineSelectionAnchor(undefined);
        return undefined;
      }
      const range = lineSelectionAnchor === undefined
        ? { endLine: line, line }
        : {
          endLine: Math.max(lineSelectionAnchor, line),
          line: Math.min(lineSelectionAnchor, line),
        };
      setLineSelectionAnchor(lineSelectionAnchor ?? line);
      return range;
    });
  };

  const handleOpenCommentForm = () => {
    if (!selectedRange) return;
    setActiveCommentLine(selectedRange.endLine);
    setActiveRange(selectedRange);
  };

  const handleCloseCommentForm = () => {
    setActiveCommentLine(undefined);
    setActiveRange(undefined);
    setSelectedRange(undefined);
    setLineSelectionAnchor(undefined);
  };

  const components = useMemo<Components>(() => {
    const commentCallbacks = {
      activeCommentLine,
      activeRange,
      onCloseCommentForm: handleCloseCommentForm,
      onCreateComment,
      onDeleteComment,
      onDeleteReply,
      onOpenCommentForm: handleOpenCommentForm,
      onSelectCommentLine: handleSelectCommentLine,
      onReplyComment,
      onResolveComment,
      onUpdateComment,
      onUpdateReply,
      selectedRange,
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
    activeCommentLine,
    activeRange,
    commentsByLine,
    lineSelectionAnchor,
    onCreateComment,
    onDeleteComment,
    onDeleteReply,
    onReplyComment,
    onResolveComment,
    onUpdateComment,
    onUpdateReply,
    selectedRange,
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
