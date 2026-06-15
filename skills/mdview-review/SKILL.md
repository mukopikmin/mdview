---
name: mdview-review
description: Read unresolved mdview review comments through the mdview CLI, apply the requested changes to the referenced Markdown document, verify the result, and resolve only completed comments. Use when asked to review, address, incorporate, or fix feedback attached to a Markdown file with mdview.
---

# mdview Review

Use the `mdview` CLI to access review comments. Do not read or modify mdview's
comment storage files directly.

## Workflow

1. Identify the target Markdown document.
2. Inspect its unresolved comments:

   ```sh
   mdview comments inspect <markdown-path>
   ```

   The command returns JSON containing the canonical Markdown path and
   position-adjusted unresolved comments.
3. Read the target document and applicable project instructions. For each
   comment, interpret `body` as the request and use `line`, `sourceText`, and
   nearby document content to identify its subject.
4. Classify each comment:
   - **Actionable**: specific enough to implement.
   - **Already satisfied**: the document already meets the request.
   - **Needs clarification**: a concrete question can unblock the work.
   - **Ambiguous**: the intent or target cannot be established safely and no
     useful question can be formed.
   - **Invalid**: the request conflicts with verified facts or requirements.
5. Reply to comments that need clarification and leave them unresolved:

   ```sh
   mdview comments reply <markdown-path> <comment-id> "<question>"
   ```

   Keep the question concise and state the missing decision or information.
6. Apply actionable comments as one coherent edit. Preserve the document's
   language, tone, structure, terminology, links, and formatting unless the
   feedback requests otherwise.
7. Review the resulting diff and run relevant documentation checks available in
   the project.
8. Resolve only comments that were successfully addressed or already satisfied:

   ```sh
   mdview comments resolve <markdown-path> <comment-id>...
   ```

9. Run `mdview comments inspect <markdown-path>` again. Report the changed
   document, replies posted, resolved comment IDs, and comments left open with
   their reasons.

## Interpretation Rules

- Ignore comments with `resolved: true`; `inspect` normally omits them.
- Treat `stale: true` as a position warning. Search for `sourceText` and inspect
  nearby headings and paragraphs before deciding the target is unavailable.
- Do not invent substantive facts missing from the document or its project.
  Leave those comments open and explain what information is required.
- Combine overlapping comments into one consistent edit.
- Do not act on vague or nonsensical feedback speculatively.
- Do not reply merely to acknowledge a comment. Reply only when the response
  communicates useful information or asks a question needed to continue.
- Do not resolve comments merely because they were reviewed.
- Do not use `mdview comments rm`; it deletes the entire stored review file.

## Failure Handling

- If `mdview` is unavailable, report that the CLI must be installed or exposed
  on `PATH`. Do not fall back to direct comment-storage access.
- If `inspect` reports no comments, make no document changes unless the user
  requested additional edits independently.
- If resolving any requested ID fails, leave the comments open and report the
  command error.
