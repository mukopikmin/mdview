import { useState } from "react";
import type { PreviewComment } from "./comments";

export type CommentItemProps = {
  className?: string;
  comment: PreviewComment;
  lineLabel: string;
  onDeleteComment: (id: string) => Promise<void>;
  onReopenComment?: (id: string) => Promise<void>;
  onResolveComment?: (id: string) => Promise<void>;
  onUpdateComment: (id: string, body: string) => Promise<void>;
  showSource?: boolean;
  showState?: boolean;
};

const getSourceLabel = (comment: PreviewComment): string =>
  comment.stale ? "Original line" : "Target line";

export const CommentItem = ({
  className,
  comment,
  lineLabel,
  onDeleteComment,
  onReopenComment,
  onResolveComment,
  onUpdateComment,
  showSource = false,
  showState = false,
}: CommentItemProps) => {
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

  const handleResolve = async () => {
    if (!onResolveComment) return;
    setIsSaving(true);
    setError(undefined);
    try {
      await onResolveComment(comment.id);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleReopen = async () => {
    if (!onReopenComment) return;
    setIsSaving(true);
    setError(undefined);
    try {
      await onReopenComment(comment.id);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <article className={["comment-item", className].filter(Boolean).join(" ")}>
      <div className="comment-item-header">
        <div className="comment-thread-heading">
          <span>{lineLabel}</span>
          {showState && comment.resolved && (
            <span className="comment-state">Resolved</span>
          )}
          {showState && !comment.resolved && comment.stale && (
            <span className="comment-state">Stale</span>
          )}
        </div>
        {!isEditing && (
          <div className="comment-actions">
            {comment.resolved
              ? (
                onReopenComment && (
                  <button
                    disabled={isSaving}
                    onClick={handleReopen}
                    type="button"
                  >
                    Reopen
                  </button>
                )
              )
              : (
                onResolveComment && (
                  <button
                    disabled={isSaving}
                    onClick={handleResolve}
                    type="button"
                  >
                    Resolve
                  </button>
                )
              )}
            <button
              disabled={isSaving}
              onClick={() => setIsEditing(true)}
              type="button"
            >
              Edit
            </button>
            <button disabled={isSaving} onClick={handleDelete} type="button">
              Delete
            </button>
          </div>
        )}
      </div>
      {showSource && comment.sourceText && (
        <div className="comment-source-block">
          <div className="comment-source-label">{getSourceLabel(comment)}</div>
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
        : <div className="comment-body">{comment.body}</div>}
      {error && <div className="comment-error">{error}</div>}
    </article>
  );
};
