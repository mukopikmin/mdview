import { CommentItem } from "./CommentItem";
import type { PreviewComment } from "./comments";

export type CommentListProps = {
  comments: PreviewComment[];
  onDeleteComment: (id: string) => Promise<void>;
  onDeleteReply: (commentId: string, replyId: string) => Promise<void>;
  onReplyComment: (id: string, body: string) => Promise<void>;
  onReopenComment: (id: string) => Promise<void>;
  onResolveComment: (id: string) => Promise<void>;
  onUpdateComment: (id: string, body: string) => Promise<void>;
  onUpdateReply: (
    commentId: string,
    replyId: string,
    body: string,
  ) => Promise<void>;
};

const formatLineLabel = (comment: PreviewComment): string => {
  const endLine = comment.endLine ?? comment.line;
  const originalEndLine = comment.originalEndLine ?? comment.originalLine;
  const currentLabel = comment.line === endLine
    ? `Line ${comment.line}`
    : `Lines ${comment.line}-${endLine}`;
  const originalLabel = comment.originalLine === originalEndLine
    ? `line ${comment.originalLine}`
    : `lines ${comment.originalLine}-${originalEndLine}`;
  if (comment.stale) return `Originally ${originalLabel}`;
  if (comment.originalLine !== comment.line) {
    return `${currentLabel} (originally ${originalLabel})`;
  }
  return currentLabel;
};

type CommentSectionProps =
  & {
    comments: PreviewComment[];
    emptyText: string;
    title: string;
  }
  & Pick<
    CommentListProps,
    | "onDeleteComment"
    | "onDeleteReply"
    | "onReplyComment"
    | "onReopenComment"
    | "onResolveComment"
    | "onUpdateComment"
    | "onUpdateReply"
  >;

const CommentSection = ({
  comments,
  emptyText,
  onDeleteComment,
  onDeleteReply,
  onReplyComment,
  onReopenComment,
  onResolveComment,
  onUpdateComment,
  onUpdateReply,
  title,
}: CommentSectionProps) => (
  <section className="comment-list-section">
    <h2>{title}</h2>
    {comments.length === 0
      ? <p className="comment-list-empty">{emptyText}</p>
      : (
        <div className="comment-list-items">
          {comments.map((comment) => (
            <CommentItem
              className="comment-list-item"
              comment={comment}
              key={comment.id}
              lineLabel={formatLineLabel(comment)}
              onDeleteComment={onDeleteComment}
              onDeleteReply={onDeleteReply}
              onReplyComment={onReplyComment}
              onReopenComment={onReopenComment}
              onResolveComment={onResolveComment}
              onUpdateComment={onUpdateComment}
              onUpdateReply={onUpdateReply}
              showSource
              showState
            />
          ))}
        </div>
      )}
  </section>
);

export const CommentList = ({
  comments,
  onDeleteComment,
  onDeleteReply,
  onReplyComment,
  onReopenComment,
  onResolveComment,
  onUpdateComment,
  onUpdateReply,
}: CommentListProps) => {
  const activeComments = comments.filter((comment) =>
    !comment.resolved && !comment.stale
  );
  const staleComments = comments.filter((comment) =>
    !comment.resolved && comment.stale
  );
  const resolvedComments = comments.filter((comment) => comment.resolved);

  return (
    <div className="comment-list">
      <CommentSection
        comments={activeComments}
        emptyText="No active comments."
        onDeleteComment={onDeleteComment}
        onDeleteReply={onDeleteReply}
        onReplyComment={onReplyComment}
        onReopenComment={onReopenComment}
        onResolveComment={onResolveComment}
        onUpdateComment={onUpdateComment}
        onUpdateReply={onUpdateReply}
        title={`Active comments (${activeComments.length})`}
      />
      <CommentSection
        comments={staleComments}
        emptyText="No stale comments."
        onDeleteComment={onDeleteComment}
        onDeleteReply={onDeleteReply}
        onReplyComment={onReplyComment}
        onReopenComment={onReopenComment}
        onResolveComment={onResolveComment}
        onUpdateComment={onUpdateComment}
        onUpdateReply={onUpdateReply}
        title={`Stale comments (${staleComments.length})`}
      />
      <CommentSection
        comments={resolvedComments}
        emptyText="No resolved comments."
        onDeleteComment={onDeleteComment}
        onDeleteReply={onDeleteReply}
        onReplyComment={onReplyComment}
        onReopenComment={onReopenComment}
        onResolveComment={onResolveComment}
        onUpdateComment={onUpdateComment}
        onUpdateReply={onUpdateReply}
        title={`Resolved comments (${resolvedComments.length})`}
      />
    </div>
  );
};
