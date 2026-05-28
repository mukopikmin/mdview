import { parseArgs as parseCliArgs } from "@std/cli/parse-args";

export type CliOptions = {
  file: string | undefined;
  host: string;
  port: number;
  help?: boolean;
  version?: boolean;
};

export const version = "0.1.0";

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

export const usage = `Usage: mdview <file.md> [--port <port>] [--host <host>]

Options:
  -p, --port   Port to bind. Defaults to 3334.
  --host       Host to bind. Defaults to 127.0.0.1.
  -v, --version
               Show version.
  -h, --help   Show this help message.
`;

export const parseArgs = (argv: string[]): CliOptions => {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--host" || arg === "--port" || arg === "-p") {
      if (!argv[index + 1]) {
        throw new CliUsageError(`${arg} requires a value.`);
      }
      index += 1;
      continue;
    }
    if (
      arg.startsWith("-") &&
      arg !== "--help" &&
      arg !== "-h" &&
      arg !== "--version" &&
      arg !== "-v"
    ) {
      throw new CliUsageError(`Unknown option: ${arg}`);
    }
  }

  let flags: ReturnType<typeof parseCliArgs>;
  try {
    flags = parseCliArgs(argv, {
      alias: {
        h: "help",
        p: "port",
        v: "version",
      },
      boolean: ["help", "version"],
      default: {
        host: "127.0.0.1",
        port: "3334",
      },
      string: ["host", "port"],
      unknown: () => true,
    });
  } catch (error) {
    throw new CliUsageError(
      error instanceof Error ? error.message : String(error),
    );
  }

  if (flags._.length > 1) {
    throw new CliUsageError(
      "Only one Markdown file can be previewed at a time.",
    );
  }

  const port = Number(flags.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new CliUsageError(`Invalid port: ${flags.port}`);
  }

  const options: CliOptions = {
    file: flags._[0]?.toString(),
    host: flags.host?.toString() ?? "127.0.0.1",
    port,
  };
  if (flags.help) options.help = true;
  if (flags.version) options.version = true;

  return options;
};
