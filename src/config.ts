import { join } from "@std/path";
import { parse } from "@std/toml";

const appDirectoryName = "sadoku";
const configFileName = "config.toml";

export type SadokuConfig = {
  commentsDirectory?: string;
};

const getEnv = (name: string): string | undefined => {
  try {
    return Deno.env.get(name);
  } catch (error) {
    if (error instanceof Deno.errors.PermissionDenied) {
      throw new Error(
        "Cannot read Sadoku config without environment access. Allow HOME, XDG_CONFIG_HOME, and APPDATA.",
      );
    }
    throw error;
  }
};

export const getConfigFilePath = (): string | undefined => {
  if (Deno.build.os === "windows") {
    const appData = getEnv("APPDATA");
    if (appData) return join(appData, appDirectoryName, configFileName);
  }

  const xdgConfigHome = getEnv("XDG_CONFIG_HOME");
  if (xdgConfigHome) {
    return join(xdgConfigHome, appDirectoryName, configFileName);
  }

  const home = getEnv("HOME");
  if (home) return join(home, ".config", appDirectoryName, configFileName);

  return undefined;
};

const parseConfig = (value: unknown): SadokuConfig | undefined => {
  if (typeof value !== "object" || value === null) return undefined;

  const config: SadokuConfig = {};
  if (!("commentsDirectory" in value)) return config;

  const commentsDirectory = (value as { commentsDirectory: unknown })
    .commentsDirectory;
  if (typeof commentsDirectory !== "string") {
    throw new Error("commentsDirectory in Sadoku config must be a string.");
  }

  if (commentsDirectory) config.commentsDirectory = commentsDirectory;
  return config;
};

export const readConfig = (): SadokuConfig | undefined => {
  const configFilePath = getConfigFilePath();
  if (!configFilePath) return undefined;

  let parsed: unknown;
  try {
    parsed = parse(Deno.readTextFileSync(configFilePath));
  } catch (error) {
    if (
      error instanceof Deno.errors.NotFound ||
      error instanceof SyntaxError
    ) return undefined;
    throw error;
  }

  return parseConfig(parsed);
};
