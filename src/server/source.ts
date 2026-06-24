import { basename, resolve, toFileUrl } from "@std/path";

export type PreviewSource = {
  commentSource: string;
  documentSource: string;
  isRemote: boolean;
};

export const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export const createPreviewSource = (input: string): PreviewSource => {
  if (!isHttpUrl(input)) {
    const filePath = resolve(input);
    return {
      commentSource: filePath,
      documentSource: filePath,
      isRemote: false,
    };
  }

  const documentUrl = new URL(input);
  const commentUrl = new URL(documentUrl.href);
  commentUrl.search = "";
  commentUrl.hash = "";
  return {
    commentSource: commentUrl.href,
    documentSource: documentUrl.href,
    isRemote: true,
  };
};

export const readMarkdownSource = async (source: string): Promise<string> => {
  if (!isHttpUrl(source)) return await Deno.readTextFile(source);

  const response = await fetch(new URL(source));
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Markdown URL: ${response.status} ${response.statusText}`
        .trimEnd(),
    );
  }
  return await response.text();
};

export const sourceTitle = (source: string): string => {
  if (!isHttpUrl(source)) return basename(source);

  const url = new URL(source);
  const pathnameTitle = basename(decodeURIComponent(url.pathname));
  return pathnameTitle || url.hostname;
};

export const sourceUrl = (source: string): string =>
  isHttpUrl(source) ? new URL(source).href : toFileUrl(source).href;
