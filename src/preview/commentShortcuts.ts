import type React from "react";

export const isCommentSubmitShortcut = (
  event: React.KeyboardEvent<HTMLTextAreaElement>,
): boolean => {
  if (event.key !== "Enter") return false;
  if (event.altKey || event.shiftKey) return false;
  return event.metaKey || event.ctrlKey;
};

export const submitCommentOnShortcut = (
  event: React.KeyboardEvent<HTMLTextAreaElement>,
  submit: () => void,
): void => {
  if (!isCommentSubmitShortcut(event)) return;
  event.preventDefault();
  submit();
};
