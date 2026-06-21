import { assertEquals, assertThrows } from "@std/assert";
import { dirname, join } from "@std/path";

import { getConfigFilePath, readConfig } from "./config.ts";

type ConfigEnvironmentPaths = {
  configFilePath: string;
  defaultConfigFilePath: string;
  root: string;
};

const trackedEnvironmentNames = [
  "APPDATA",
  "HOME",
  "XDG_CONFIG_HOME",
] as const;

const withConfigEnvironment = async (
  run: (paths: ConfigEnvironmentPaths) => Promise<void>,
): Promise<void> => {
  const previous = new Map(
    trackedEnvironmentNames.map((name) => [name, Deno.env.get(name)]),
  );
  const root = await Deno.makeTempDir({ prefix: "mdview-config-" });
  const appData = join(root, "appdata");
  const configHome = join(root, "config");
  const home = join(root, "home");

  Deno.env.set("APPDATA", appData);
  Deno.env.set("HOME", home);
  Deno.env.set("XDG_CONFIG_HOME", configHome);

  const defaultConfigFilePath = Deno.build.os === "darwin"
    ? join(home, "Library", "Application Support", "mdview", "config.toml")
    : Deno.build.os === "windows"
    ? join(appData, "mdview", "config.toml")
    : join(configHome, "mdview", "config.toml");

  try {
    await run({
      configFilePath: defaultConfigFilePath,
      defaultConfigFilePath,
      root,
    });
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) {
        Deno.env.delete(name);
      } else {
        Deno.env.set(name, value);
      }
    }
    await Deno.remove(root, { recursive: true }).catch(() => {});
  }
};

const writeConfig = async (
  configFilePath: string,
  text: string,
): Promise<void> => {
  await Deno.mkdir(dirname(configFilePath), { recursive: true });
  await Deno.writeTextFile(configFilePath, text);
};

Deno.test("resolves the mdview config file path", async () => {
  await withConfigEnvironment(async ({ defaultConfigFilePath }) => {
    assertEquals(getConfigFilePath(), defaultConfigFilePath);
  });
});

Deno.test("reads comments directory from config", async () => {
  await withConfigEnvironment(async ({ configFilePath, root }) => {
    const commentsDirectory = join(root, "configured-comments");
    await writeConfig(
      configFilePath,
      `commentsDirectory = ${JSON.stringify(commentsDirectory)}\n`,
    );

    assertEquals(readConfig(), { commentsDirectory });
  });
});

Deno.test("reads config without comments directory", async () => {
  await withConfigEnvironment(async ({ configFilePath }) => {
    await writeConfig(configFilePath, "");

    assertEquals(readConfig(), {});
  });
});

Deno.test("ignores missing or malformed config", async () => {
  await withConfigEnvironment(async ({ configFilePath }) => {
    assertEquals(readConfig(), undefined);

    await writeConfig(configFilePath, "{");

    assertEquals(readConfig(), undefined);
  });
});

Deno.test("rejects invalid comments directory config type", async () => {
  await withConfigEnvironment(async ({ configFilePath }) => {
    await writeConfig(
      configFilePath,
      "commentsDirectory = 42\n",
    );

    assertThrows(
      () => readConfig(),
      Error,
      "commentsDirectory in mdview config must be a string.",
    );
  });
});
