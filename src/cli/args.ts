import { parseArgs as parseCliArgs } from "@std/cli/parse-args";
export { version } from "../version.ts";

export type CliOptions = {
  command?:
    | "comments-inspect"
    | "comments-list"
    | "comments-reply"
    | "comments-resolve"
    | "comments-rm";
  commentId?: string;
  commentIds?: string[];
  file: string | undefined;
  force: boolean;
  host: string;
  keepAlive: boolean;
  open: boolean;
  port: number;
  replyBody?: string;
  help?: boolean;
  version?: boolean;
};

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

export const usage = `Usage:
  sadoku <file.md|url> [--port <port>] [--host <host>] [--no-open] [--keep-alive]
  sadoku comments inspect <file.md|url>
  sadoku comments reply <file.md|url> <comment-id> <body>
  sadoku comments resolve <file.md|url> <comment-id>...
  sadoku comments list
  sadoku comments rm <file.md|url> [--force]

Options:
  -p, --port   Starting port to bind. Defaults to 3334.
  --host       Host to bind. Defaults to 127.0.0.1.
  --no-open    Do not open the preview in your browser automatically.
  --keep-alive Keep the server running after the browser tab is closed.
  --force      Remove comments without prompting.
  -v, --version
               Show version.
  -h, --help   Show this help message.
`;

export const parseArgs = (argv: string[]): CliOptions => {
  let flags: ReturnType<typeof parseCliArgs>;
  try {
    flags = parseCliArgs(argv, {
      alias: {
        h: "help",
        p: "port",
        v: "version",
      },
      boolean: ["force", "help", "keep-alive", "no-open", "version"],
      default: {
        host: "127.0.0.1",
        port: "3334",
      },
      string: ["host", "port"],
      unknown: (arg) => {
        if (!arg.startsWith("-")) return true;
        throw new CliUsageError(`Unknown option: ${arg}`);
      },
    });
  } catch (error) {
    throw new CliUsageError(
      error instanceof Error ? error.message : String(error),
    );
  }

  const rejectCommentCommandPreviewOptions = (command: string): void => {
    if (
      flags.host !== "127.0.0.1" || flags.port !== "3334" ||
      flags["keep-alive"] || flags["no-open"]
    ) {
      throw new CliUsageError(
        `${command} does not accept preview options.`,
      );
    }
  };

  if (flags._[0]?.toString() === "comments") {
    if (
      flags._.length === 2 &&
      flags._[1]?.toString() === "list"
    ) {
      rejectCommentCommandPreviewOptions("comments list");

      const options: CliOptions = {
        command: "comments-list",
        file: undefined,
        force: false,
        host: "127.0.0.1",
        keepAlive: false,
        open: true,
        port: 3334,
      };
      if (flags.help) options.help = true;
      if (flags.version) options.version = true;
      return options;
    }

    if (
      flags._.length === 3 &&
      flags._[1]?.toString() === "rm"
    ) {
      rejectCommentCommandPreviewOptions("comments rm");

      const options: CliOptions = {
        command: "comments-rm",
        file: flags._[2]?.toString(),
        force: Boolean(flags.force),
        host: "127.0.0.1",
        keepAlive: false,
        open: true,
        port: 3334,
      };
      if (flags.help) options.help = true;
      if (flags.version) options.version = true;
      return options;
    }

    if (
      flags._.length === 3 &&
      flags._[1]?.toString() === "inspect"
    ) {
      rejectCommentCommandPreviewOptions("comments inspect");

      const options: CliOptions = {
        command: "comments-inspect",
        file: flags._[2]?.toString(),
        force: false,
        host: "127.0.0.1",
        keepAlive: false,
        open: true,
        port: 3334,
      };
      if (flags.help) options.help = true;
      if (flags.version) options.version = true;
      return options;
    }

    if (
      flags._.length >= 5 &&
      flags._[1]?.toString() === "reply"
    ) {
      rejectCommentCommandPreviewOptions("comments reply");

      const options: CliOptions = {
        command: "comments-reply",
        commentId: flags._[3]?.toString(),
        file: flags._[2]?.toString(),
        force: false,
        host: "127.0.0.1",
        keepAlive: false,
        open: true,
        port: 3334,
        replyBody: flags._.slice(4).map(String).join(" "),
      };
      if (flags.help) options.help = true;
      if (flags.version) options.version = true;
      return options;
    }

    if (
      flags._.length >= 4 &&
      flags._[1]?.toString() === "resolve"
    ) {
      rejectCommentCommandPreviewOptions("comments resolve");

      const options: CliOptions = {
        command: "comments-resolve",
        commentIds: flags._.slice(3).map(String),
        file: flags._[2]?.toString(),
        force: false,
        host: "127.0.0.1",
        keepAlive: false,
        open: true,
        port: 3334,
      };
      if (flags.help) options.help = true;
      if (flags.version) options.version = true;
      return options;
    }

    throw new CliUsageError("Invalid comments command.");
  }

  if (flags._.length > 1) {
    throw new CliUsageError(
      "Only one Markdown file can be previewed at a time.",
    );
  }

  if (flags.host === "") throw new CliUsageError("--host requires a value.");
  if (flags.port === "") throw new CliUsageError("--port requires a value.");

  const port = Number(flags.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new CliUsageError(`Invalid port: ${flags.port}`);
  }

  const options: CliOptions = {
    file: flags._[0]?.toString(),
    force: false,
    host: flags.host?.toString() ?? "127.0.0.1",
    keepAlive: Boolean(flags["keep-alive"]),
    open: !flags["no-open"],
    port,
  };
  if (flags.help) options.help = true;
  if (flags.version) options.version = true;

  return options;
};
