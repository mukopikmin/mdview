import { useState } from "react";
import type { PreviewComment } from "./comments";

export type CommentListProps = {
  comments: PreviewComment[];
  onDeleteComment: (id: string) => Promise<void>;
  onUpdateComment: (id: string, body: string) => Promise<void>;
};

type CommentListItemProps = {
  comment: PreviewComment;
  onDeleteComment: (id: string) => Promise<void>;
  onUpdateComment: (id: string, body: string) => Promise<void>;
};

const formatLineLabel = (comment: PreviewComment): string => {
  if (comment.stale) return `Originally line ${comment.originalLine}`;
  if (comment.originalLine !== comment.line) {
    return `Line ${comment.line} (originally ${comment.originalLine})`;
  }
  return `Line ${comment.line}`;
};

const CommentListItem = ({
  comment,
  onDeleteComment,
  onUpdateComment,
}: CommentListItemProps) => {
  const [draft, setDraft] = useState(comment.body);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();

  const handleUpdate = async () => {
    const body = draft.trim();
    if (!body) return;
    setIsSaving(true);
    setError(undefined);
    try {
      await onUpdateComment(comment.id, body);
      setIsEditing(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    setError(undefined);
    try {
      await onDeleteComment(comment.id);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      setIsSaving(false);
    }
  };

  return (
    <article className="comment-list-item">
      <div className="comment-list-meta">
        <span>{formatLineLabel(comment)}</span>
        {comment.stale && <span className="comment-state">Stale</span>}
      </div>
      {comment.sourceText && (
        <div className="comment-source-block">
          <div className="comment-source-label">
            {comment.stale ? "Original line" : "Target line"}
          </div>
          <pre className="comment-source">{comment.sourceText}</pre>
        </div>
      )}
      {isEditing
        ? (
          <>
            <textarea
              className="comment-input"
              onChange={(event) => setDraft(event.target.value)}
              value={draft}
            />
            <div className="comment-actions">
              <button
                disabled={isSaving || draft.trim() === ""}
                onClick={handleUpdate}
                type="button"
              >
                Save
              </button>
              <button
                disabled={isSaving}
                onClick={() => {
                  setDraft(comment.body);
                  setIsEditing(false);
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </>
        )
        : (
          <>
            <div className="comment-body">{comment.body}</div>
            <div className="comment-actions">
              <button
                disabled={isSaving}
                onClick={() => setIsEditing(true)}
                type="button"
              >
                Edit
              </button>
              <button
                disabled={isSaving}
                onClick={handleDelete}
                type="button"
              >
                Delete
              </button>
            </div>
          </>
        )}
      {error && <div className="comment-error">{error}</div>}
    </article>
  );
};

type CommentSectionProps = {
  comments: PreviewComment[];
  emptyText: string;
  title: string;
} & Pick<CommentListProps, "onDeleteComment" | "onUpdateComment">;

const CommentSection = ({
  comments,
  emptyText,
  onDeleteComment,
  onUpdateComment,
  title,
}: CommentSectionProps) => (
  <section className="comment-list-section">
    <h2>{title}</h2>
    {comments.length === 0
      ? <p className="comment-list-empty">{emptyText}</p>
      : (
        <div className="comment-list-items">
          {comments.map((comment) => (
            <CommentListItem
              comment={comment}
              key={comment.id}
              onDeleteComment={onDeleteComment}
              onUpdateComment={onUpdateComment}
            />
          ))}
        </div>
      )}
  </section>
);

export const CommentList = ({
  comments,
  onDeleteComment,
  onUpdateComment,
}: CommentListProps) => {
  const activeComments = comments.filter((comment) => !comment.stale);
  const staleComments = comments.filter((comment) => comment.stale);

  return (
    <div className="comment-list">
      <CommentSection
        comments={activeComments}
        emptyText="No active comments."
        onDeleteComment={onDeleteComment}
        onUpdateComment={onUpdateComment}
        title={`Active comments (${activeComments.length})`}
      />
      <CommentSection
        comments={staleComments}
        emptyText="No stale comments."
        onDeleteComment={onDeleteComment}
        onUpdateComment={onUpdateComment}
        title={`Stale comments (${staleComments.length})`}
      />
    </div>
  );
};
