#!/usr/bin/env -S deno run --allow-read --allow-write --allow-net --allow-run --allow-env=BROWSER,HOME,XDG_DATA_HOME,APPDATA,MDVIEW_COMMENTS_DIR
import { CliUsageError, parseArgs, usage, version } from "./cli/args.ts";
import { openBrowser } from "./cli/browser.ts";
import { formatCommentFilesTable, listCommentFiles } from "./cli/comments.ts";
import { logInfo } from "./log.ts";
import { startPreviewServer } from "./server/mod.ts";

const main = async (): Promise<void> => {
  const options = parseArgs(Deno.args);

  if (options.help) {
    console.log(usage);
    return;
  }

  if (options.version) {
    console.log(`mdview ${version}`);
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
