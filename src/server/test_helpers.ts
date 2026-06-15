import { getCommentsFilePath } from "./comments/storage.ts";

export const serveHandlerInfo = {} as Deno.ServeHandlerInfo<Deno.NetAddr>;

export const createTempMarkdown = async (
  markdown = "# Title\n\nBody\n",
): Promise<string> => {
  const filePath = await Deno.makeTempFile({
    prefix: "mdview-",
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
  const previous = Deno.env.get("MDVIEW_COMMENTS_DIR");
  const directory = await Deno.makeTempDir({ prefix: "mdview-comments-" });
  Deno.env.set("MDVIEW_COMMENTS_DIR", directory);
  try {
    await run();
  } finally {
    if (previous === undefined) {
      Deno.env.delete("MDVIEW_COMMENTS_DIR");
    } else {
      Deno.env.set("MDVIEW_COMMENTS_DIR", previous);
    }
    await Deno.remove(directory, { recursive: true }).catch(() => {});
  }
};
