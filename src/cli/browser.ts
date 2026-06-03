import { logError } from "../log.ts";

type OpenBrowserCommand = {
  command: string;
  args: string[];
};

export const buildOpenBrowserCommand = (
  url: string,
  os: typeof Deno.build.os = Deno.build.os,
): OpenBrowserCommand | undefined => {
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
  const command = buildOpenBrowserCommand(url);
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
