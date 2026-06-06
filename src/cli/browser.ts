import { logError } from "../log.ts";

type OpenBrowserCommand = {
  command: string;
  args: string[];
};

const parseCommandLine = (value: string): string[] => {
  const parts: string[] = [];
  let current = "";
  let quote: '"' | "'" | undefined;

  for (const char of value.trim()) {
    if (quote) {
      if (char === quote) {
        quote = undefined;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        parts.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) {
    parts.push(current);
  }

  return parts;
};

const buildCustomBrowserCommand = (
  url: string,
  browserCommand: string | undefined,
): OpenBrowserCommand | undefined => {
  if (!browserCommand?.trim()) {
    return undefined;
  }

  const [command, ...browserArgs] = parseCommandLine(browserCommand);
  if (!command) {
    return undefined;
  }

  let hasUrlPlaceholder = false;
  const args = browserArgs.map((arg) => {
    if (!arg.includes("%s")) return arg;
    hasUrlPlaceholder = true;
    return arg.replaceAll("%s", url);
  });

  if (!hasUrlPlaceholder) {
    args.push(url);
  }

  return { command, args };
};

export const buildOpenBrowserCommand = (
  url: string,
  os: typeof Deno.build.os = Deno.build.os,
  browserCommand?: string,
): OpenBrowserCommand | undefined => {
  const customCommand = buildCustomBrowserCommand(url, browserCommand);
  if (customCommand) {
    return customCommand;
  }

  switch (os) {
    case "darwin":
      return { command: "open", args: [url] };
    case "windows":
      return { command: "cmd", args: ["/c", "start", "", url] };
    case "linux":
      return { command: "xdg-open", args: [url] };
    default:
      return undefined;
  }
};

export const openBrowser = async (url: string): Promise<void> => {
  const command = buildOpenBrowserCommand(
    url,
    Deno.build.os,
    Deno.env.get("BROWSER"),
  );
  if (!command) {
    logError(
      `Automatic browser opening is not supported on ${Deno.build.os}.`,
    );
    return;
  }

  try {
    const result = await new Deno.Command(command.command, {
      args: command.args,
      stdout: "null",
      stderr: "null",
    }).output();

    if (!result.success) {
      logError(
        `Failed to open browser automatically: ${command.command} exited with ${result.code}.`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError(`Failed to open browser automatically: ${message}`);
  }
};
