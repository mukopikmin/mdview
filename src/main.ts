#!/usr/bin/env -S deno run --allow-read --allow-write --allow-net --allow-run --allow-env=BROWSER,HOME,XDG_DATA_HOME,APPDATA,SADOKU_COMMENTS_DIR,MDVIEW_COMMENTS_DIR
import { CliUsageError, parseArgs, usage, version } from "./cli/args.ts";
import { openBrowser } from "./cli/browser.ts";
import {
  formatCommentFilesTable,
  inspectComments,
  listCommentFiles,
  removeComments,
  removeCommentsIfConfirmed,
  replyToComment,
  resolveComments,
} from "./cli/comments.ts";
import { logInfo } from "./log.ts";
import { startPreviewServer } from "./server/mod.ts";

const main = async (): Promise<void> => {
  const options = parseArgs(Deno.args);

  if (options.help) {
    console.log(usage);
    return;
  }

  if (options.version) {
    console.log(`sadoku ${version}`);
    return;
  }

  if (options.command === "comments-list") {
    const result = await listCommentFiles();
    for (const warning of result.warnings) {
      console.error(`Warning: ${warning}`);
    }
    console.log(formatCommentFilesTable(result.entries).trimEnd());
    return;
  }

  if (options.command === "comments-inspect") {
    if (!options.file) {
      throw new CliUsageError("Missing Markdown file.");
    }
    console.log(JSON.stringify(await inspectComments(options.file), null, 2));
    return;
  }

  if (options.command === "comments-resolve") {
    if (!options.file) {
      throw new CliUsageError("Missing Markdown file.");
    }
    console.log(
      JSON.stringify(
        await resolveComments(options.file, options.commentIds ?? []),
        null,
        2,
      ),
    );
    return;
  }

  if (options.command === "comments-reply") {
    if (!options.file) {
      throw new CliUsageError("Missing Markdown file.");
    }
    if (!options.commentId) {
      throw new CliUsageError("Missing comment ID.");
    }
    console.log(
      JSON.stringify(
        await replyToComment(
          options.file,
          options.commentId,
          options.replyBody ?? "",
        ),
        null,
        2,
      ),
    );
    return;
  }

  if (options.command === "comments-rm") {
    if (!options.file) {
      throw new CliUsageError("Missing Markdown file.");
    }

    let filePath: string | undefined;
    if (options.force) {
      filePath = await removeComments(options.file);
    } else {
      const answer = prompt(`Remove comments for ${options.file}? [y/N]`);
      filePath = await removeCommentsIfConfirmed(options.file, answer ?? "");
      if (!filePath) {
        console.log("Not removed.");
        return;
      }
    }

    console.log(`Removed comments for ${filePath}`);
    return;
  }

  if (!options.file) {
    throw new CliUsageError("Missing Markdown file.");
  }

  const preview = await startPreviewServer({
    file: options.file,
    host: options.host,
    keepAlive: options.keepAlive,
    port: options.port,
  });

  logInfo(`Serving ${preview.filePath}`);
  logInfo(`Preview: ${preview.url}`);

  if (options.open) {
    await openBrowser(preview.url);
  }
};

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  if (error instanceof CliUsageError) {
    console.error(usage);
  }
  Deno.exitCode = 1;
}
