import { join } from "@std/path";
import {
  getCommentsDirectoryPath,
  getCommentsFilePath,
} from "./comments/storage.ts";

export const serveHandlerInfo = {} as Deno.ServeHandlerInfo<Deno.NetAddr>;

export const createTempMarkdown = async (
  markdown = "# Title\n\nBody\n",
): Promise<string> => {
  const filePath = await Deno.makeTempFile({
    prefix: "sadoku-",
    suffix: ".md",
  });
  await Deno.writeTextFile(filePath, markdown);
  return filePath;
};

export const removeTempMarkdown = async (filePath: string): Promise<void> => {
  await Deno.remove(filePath).catch(() => {});
  await Deno.remove(getCommentsFilePath(filePath)).catch(() => {});
};

export const withTempCommentsDirectory = async (
  run: () => Promise<void>,
): Promise<void> => {
  const environmentNames = [
    "APPDATA",
    "HOME",
    "MDVIEW_COMMENTS_DIR",
    "SADOKU_COMMENTS_DIR",
    "XDG_CONFIG_HOME",
    "XDG_DATA_HOME",
  ] as const;
  const previous = new Map(
    environmentNames.map((name) => [name, Deno.env.get(name)]),
  );
  const root = await Deno.makeTempDir({ prefix: "sadoku-comments-" });

  Deno.env.set("APPDATA", join(root, "appdata"));
  Deno.env.set("HOME", join(root, "home"));
  Deno.env.delete("MDVIEW_COMMENTS_DIR");
  Deno.env.delete("SADOKU_COMMENTS_DIR");
  Deno.env.set("XDG_CONFIG_HOME", join(root, "config"));
  Deno.env.set("XDG_DATA_HOME", join(root, "data"));
  await Deno.mkdir(getCommentsDirectoryPath(), { recursive: true });

  try {
    await run();
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
