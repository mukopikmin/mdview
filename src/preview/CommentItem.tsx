import { useState } from "react";
import { submitCommentOnShortcut } from "./commentShortcuts";
import type { PreviewComment, PreviewCommentReply } from "./comments";

export type CommentItemProps = {
  className?: string;
  comment: PreviewComment;
  lineLabel: string;
  onDeleteComment: (id: string) => Promise<void>;
  onDeleteReply: (commentId: string, replyId: string) => Promise<void>;
  onReplyComment: (id: string, body: string) => Promise<void>;
  onReopenComment?: (id: string) => Promise<void>;
  onResolveComment?: (id: string) => Promise<void>;
  onUpdateComment: (id: string, body: string) => Promise<void>;
  onUpdateReply: (
    commentId: string,
    replyId: string,
    body: string,
  ) => Promise<void>;
  showSource?: boolean;
  showState?: boolean;
};

const getSourceLabel = (comment: PreviewComment): string =>
  comment.stale ? "Original line" : "Target line";

type ReplyItemProps = {
  commentId: string;
  disabled: boolean;
  onDelete: (commentId: string, replyId: string) => Promise<void>;
  onError: (error: unknown) => void;
  onUpdate: (
    commentId: string,
    replyId: string,
    body: string,
  ) => Promise<void>;
  reply: PreviewCommentReply;
  setSaving: (saving: boolean) => void;
};

const ReplyItem = ({
  commentId,
  disabled,
  onDelete,
  onError,
  onUpdate,
  reply,
  setSaving,
}: ReplyItemProps) => {
  const [draft, setDraft] = useState(reply.body);
  const [isEditing, setIsEditing] = useState(false);

  const handleUpdate = async () => {
    const body = draft.trim();
    if (!body || disabled) return;
    setSaving(true);
    try {
      await onUpdate(commentId, reply.id, body);
      setIsEditing(false);
    } catch (error) {
      onError(error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await onDelete(commentId, reply.id);
    } catch (error) {
      onError(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="comment-reply">
      <div className="comment-reply-header">
        <div className="comment-reply-label">Reply</div>
        {!isEditing && (
          <div className="comment-actions">
            <button
              aria-label="Edit reply"
              disabled={disabled}
              onClick={() => setIsEditing(true)}
              type="button"
            >
              Edit
            </button>
            <button
              aria-label="Delete reply"
              disabled={disabled}
              onClick={handleDelete}
              type="button"
            >
              Delete
            </button>
          </div>
        )}
      </div>
      {isEditing
        ? (
          <>
            <textarea
              aria-label="Edit reply body"
              autoFocus
              className="comment-input"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) =>
                submitCommentOnShortcut(event, () => {
                  void handleUpdate();
                })}
              value={draft}
            />
            <div className="comment-actions">
              <button
                aria-label="Save reply"
                disabled={disabled || draft.trim() === ""}
                onClick={handleUpdate}
                type="button"
              >
                Save
              </button>
              <button
                aria-label="Cancel reply edit"
                disabled={disabled}
                onClick={() => {
                  setDraft(reply.body);
                  setIsEditing(false);
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </>
        )
        : <div className="comment-body">{reply.body}</div>}
    </div>
  );
};

export const CommentItem = ({
  className,
  comment,
  lineLabel,
  onDeleteComment,
  onDeleteReply,
  onReplyComment,
  onReopenComment,
  onResolveComment,
  onUpdateComment,
  onUpdateReply,
  showSource = false,
  showState = false,
}: CommentItemProps) => {
  const [draft, setDraft] = useState(comment.body);
  const [replyDraft, setReplyDraft] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();
  const handleError = (error: unknown) => {
    setError(error instanceof Error ? error.message : String(error));
  };

  const handleUpdate = async () => {
    const body = draft.trim();
    if (!body || isSaving) return;
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

  const handleReply = async () => {
    const body = replyDraft.trim();
    if (!body || isSaving) return;
    setIsSaving(true);
    setError(undefined);
    try {
      await onReplyComment(comment.id, body);
      setReplyDraft("");
      setIsReplying(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
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
              onClick={() =>
                setIsReplying((value) => !value)}
              type="button"
            >
              Reply
            </button>
            <button
              disabled={isSaving}
              onClick={() =>
                setIsEditing(true)}
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
              autoFocus
              className="comment-input"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) =>
                submitCommentOnShortcut(event, () => {
                  void handleUpdate();
                })}
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
      {(comment.replies ?? []).length > 0 && (
        <div className="comment-replies">
          {(comment.replies ?? []).map((reply) => (
            <ReplyItem
              commentId={comment.id}
              disabled={isSaving}
              key={reply.id}
              onDelete={onDeleteReply}
              onError={handleError}
              onUpdate={onUpdateReply}
              reply={reply}
              setSaving={setIsSaving}
            />
          ))}
        </div>
      )}
      {isReplying && (
        <div className="comment-reply-form">
          <textarea
            aria-label="Reply body"
            autoFocus
            className="comment-input"
            onChange={(event) => setReplyDraft(event.target.value)}
            onKeyDown={(event) =>
              submitCommentOnShortcut(event, () => {
                void handleReply();
              })}
            placeholder="Write a reply..."
            value={replyDraft}
          />
          <div className="comment-actions">
            <button
              disabled={isSaving || replyDraft.trim() === ""}
              onClick={handleReply}
              type="button"
            >
              Add reply
            </button>
            <button
              disabled={isSaving}
              onClick={() => {
                setReplyDraft("");
                setIsReplying(false);
              }}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <div className="comment-error">{error}</div>}
    </article>
  );
};
