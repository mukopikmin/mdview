import { basename, toFileUrl } from "@std/path";
import { noStoreJson } from "../responses.ts";

export const handlePreviewDocumentRequest = async (
  filePath: string,
): Promise<Response> => {
  const markdown = await Deno.readTextFile(filePath);
  return noStoreJson({
    title: basename(filePath),
    fileUrl: toFileUrl(filePath).href,
    markdown,
  });
};
