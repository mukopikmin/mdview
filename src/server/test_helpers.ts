import { getCommentsFilePath } from "./comments/storage.ts";

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
  const previous = Deno.env.get("SADOKU_COMMENTS_DIR");
  const directory = await Deno.makeTempDir({ prefix: "sadoku-comments-" });
  Deno.env.set("SADOKU_COMMENTS_DIR", directory);
  try {
    await run();
  } finally {
    if (previous === undefined) {
      Deno.env.delete("SADOKU_COMMENTS_DIR");
    } else {
      Deno.env.set("SADOKU_COMMENTS_DIR", previous);
    }
    await Deno.remove(directory, { recursive: true }).catch(() => {});
  }
};
